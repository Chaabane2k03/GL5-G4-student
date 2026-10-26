# ---------------------------------------------------------------------------
# Helm/Terraform integration.
#
#   Terraform resource              Provisioned by     Layer
#   ------------------------        -------------------- --------
#   aws_eks_cluster / node_group    aws provider          infra
#   aws_db_instance                 aws provider          infra
#   aws_ecr_repository              aws provider          infra
#   helm_release aws-lb-controller  helm provider         in-cluster platform
#   helm_release gl5-student        helm provider         application
#
# The helm/kubernetes providers authenticate to the EKS API server with the
# exec plugin (`aws eks get-token`). Data references create the dependency
# chain: aws_eks_cluster.gl5.endpoint --> helm provider --> helm_release.
# So `terraform apply` creates the cluster, then joins Helm onto it, then
# deploys the chart — in one pass.
# ---------------------------------------------------------------------------

provider "kubernetes" {
  host                   = aws_eks_cluster.gl5.endpoint
  cluster_ca_certificate = base64decode(aws_eks_cluster.gl5.certificate_authority[0].data)

  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args = [
      "eks", "get-token",
      "--cluster-name", aws_eks_cluster.gl5.name,
      "--region", var.aws_region,
    ]
  }
}

provider "helm" {
  kubernetes = {
    host                   = aws_eks_cluster.gl5.endpoint
    cluster_ca_certificate = base64decode(aws_eks_cluster.gl5.certificate_authority[0].data)

    exec = {
      api_version = "client.authentication.k8s.io/v1beta1"
      command     = "aws"
      args = [
        "eks", "get-token",
        "--cluster-name", aws_eks_cluster.gl5.name,
        "--region", var.aws_region,
      ]
    }
  }
}

# The umbrella chart uses file:// dependencies that must be packaged before
# the release. Rebuild them whenever any chart file changes.
resource "null_resource" "helm_deps" {
  triggers = {
    chart_hash = filesha256("${path.module}/../helm/umbrella/gl5-student/Chart.yaml")
  }

  provisioner "local-exec" {
    command = "helm dependency update ${path.module}/../helm/umbrella/gl5-student"
  }
}

# --- AWS Load Balancer Controller ------------------------------------------
# No IRSA in the lab (no role creation allowed): the controller pods fall
# back to the node instance role (LabRole), which has sufficient ELB/EC2
# permission. On a real AWS account, create an IRSA role instead and
# annotate the service account.
resource "helm_release" "aws_lb_controller" {
  name       = "aws-load-balancer-controller"
  repository = "https://aws.github.io/eks-charts"
  chart      = "aws-load-balancer-controller"
  namespace  = "kube-system"
  version    = "1.13.2"
  timeout    = 900

  set = [
    { name = "clusterName", value = aws_eks_cluster.gl5.name },
    { name = "region", value = var.aws_region },
    { name = "vpcId", value = aws_vpc.gl5.id },
    # The lab does not use IRSA. Host networking lets the controller reach
    # the node instance-role credentials through EC2 instance metadata.
    { name = "hostNetwork", value = "true" },
    # Shield and WAF are optional ALB integrations and are not permitted by
    # the lab role.
    { name = "enableShield", value = "false" },
    { name = "enableWaf", value = "false" },
    { name = "enableWafv2", value = "false" },
    # With hostNetwork each replica reserves the controller ports on its node.
    # Avoid a temporary third pod during rolling upgrades.
    { name = "updateStrategy.type", value = "RollingUpdate" },
    { name = "updateStrategy.rollingUpdate.maxSurge", value = "0" },
    { name = "updateStrategy.rollingUpdate.maxUnavailable", value = "1" },
    # serviceAccount.create defaults to true; no IRSA annotation is added so
    # the controller uses the node instance role.
  ]

  depends_on = [aws_eks_node_group.app]
}

# --- The application (gl5-student umbrella chart) ---------------------------
# Values are merged in order, later ones win: first the lab overrides built
# below, then the repo's eks values file (which still references un-filled
# placeholders, but every placeholder-bearing key is overridden here).
resource "helm_release" "gl5_student" {
  name             = "gl5-student"
  chart            = "${path.module}/../helm/umbrella/gl5-student"
  namespace        = "gl5-student"
  create_namespace = true
  timeout          = 900

  # Set to true to make terraform apply block until every pod is Ready.
  # Keep false while the ECR images are not yet pushed (pods show
  # ImagePullBackOff until they are, then recover on their own).
  wait = false

  # Single self-contained values document. The repo's
  # values/eks/gl5-student.yaml is NOT merged: Helm deep-merges maps
  # key-by-key, so its <...> placeholders (ACM ARN, inbound CIDRs, HTTPS
  # listen-ports) would leak into the rendered Ingress. All keys needed for
  # the lab (images, secrets, RDS, ALB, networkPolicy, storageClass) are
  # defined below — verify coverage with `helm template` before applying.
  values = [
    yamlencode(local.app_values),
  ]

  depends_on = [
    null_resource.helm_deps,
    helm_release.aws_lb_controller,
    aws_db_instance.gl5,
  ]
}

locals {
  rds_endpoint = aws_db_instance.gl5.address

  app_values = {
    # --- Images from ECR (push after `terraform apply` on the infra part)
    imageRegistry = local.ecr_domain
    imageTag      = var.image_tag

    # Per-service values. Helm deep-merges these maps over the umbrella
    # defaults, so `env.*` and `secret.*` keys override chart defaults.
    # --- Secrets ----------------------------------------------------------
    # Lab cannot create IRSA roles (needed for External Secrets), so we ask
    # the chart to create per-service secrets from the secretData below
    # (values/eks/gl5-student.yaml says create=false for the ESO flow).
    api-gateway = {
      image      = { repository = "${local.ecr_domain}/gl5-g4-api-gateway", tag = var.image_tag }
      secret     = { create = true, existing = "" }
      secretData = {}
    }
    student-service = {
      image  = { repository = "${local.ecr_domain}/gl5-g4-student-service", tag = var.image_tag }
      secret = { create = true, existing = "" }
      env = {
        SPRING_DATASOURCE_URL = "jdbc:mysql://${local.rds_endpoint}:3306/studentdb?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC&createDatabaseIfNotExist=true"
      }
      secretData = {
        SPRING_DATASOURCE_USERNAME = var.db_username
        SPRING_DATASOURCE_PASSWORD = random_password.db_master.result
      }
    }
    course-service = {
      image  = { repository = "${local.ecr_domain}/gl5-g4-course-service", tag = var.image_tag }
      secret = { create = true, existing = "" }
      env = {
        SPRING_DATASOURCE_URL = "jdbc:mysql://${local.rds_endpoint}:3306/course_db?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC&createDatabaseIfNotExist=true"
      }
      secretData = {
        SPRING_DATASOURCE_USERNAME = var.db_username
        SPRING_DATASOURCE_PASSWORD = random_password.db_master.result
      }
    }
    department-service = {
      image  = { repository = "${local.ecr_domain}/gl5-g4-department-service", tag = var.image_tag }
      secret = { create = true, existing = "" }
      env = {
        SPRING_DATASOURCE_URL = "jdbc:mysql://${local.rds_endpoint}:3306/departmentdb?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC&createDatabaseIfNotExist=true"
      }
      secretData = {
        SPRING_DATASOURCE_USERNAME = var.db_username
        SPRING_DATASOURCE_PASSWORD = random_password.db_master.result
      }
    }
    enrollment-service = {
      image  = { repository = "${local.ecr_domain}/gl5-g4-enrollment-service", tag = var.image_tag }
      secret = { create = true, existing = "" }
      env = {
        SPRING_DATASOURCE_URL = "jdbc:mysql://${local.rds_endpoint}:3306/enrollmentdb?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC&createDatabaseIfNotExist=true"
      }
      secretData = {
        SPRING_DATASOURCE_USERNAME = var.db_username
        SPRING_DATASOURCE_PASSWORD = random_password.db_master.result
      }
    }
    keycloak = {
      image = { repository = "quay.io/keycloak/keycloak", tag = "26.0" }
      # Same ephemeral database strategy as Minikube: realm is re-imported
      # on restart, good for the demo. RDS-backed Keycloak DB is the next step.
      db          = { vendor = "dev-file" }
      persistence = { enabled = false }
    }
    frontend = {
      image = { repository = "nginx", tag = "1.27-alpine" }

      # Lab-friendly ALB: internet-facing, HTTP only (no ACM cert without a
      # DNS domain we can validate in the lab). NOTE: Helm deep-merges maps,
      # so the annotation map below must be the complete set — do not try
      # to "partially override" the values/eks/gl5-student.yaml annotations,
      # their placeholder keys would survive the merge.
      ingress = {
        enabled   = true
        className = "alb"
        host      = ""
        path      = "/"
        pathType  = "Prefix"
        annotations = {
          "alb.ingress.kubernetes.io/scheme"           = "internet-facing"
          "alb.ingress.kubernetes.io/target-type"      = "ip"
          "alb.ingress.kubernetes.io/listen-ports"     = "[{\"HTTP\": 80}]"
          "alb.ingress.kubernetes.io/healthcheck-path" = "/"
          "alb.ingress.kubernetes.io/healthcheck-port" = "traffic-port"
          "alb.ingress.kubernetes.io/success-codes"    = "200"
          "alb.ingress.kubernetes.io/group.name"       = "gl5-student"
        }
        tls = {
          enabled    = false
          secretName = ""
        }
      }
    }

    # --- Databases --------------------------------------------------------
    # All four schemas live on the ONE RDS instance. The ExternalName
    # Services keep the same DNS names as the Minikube MySQL Services, so
    # the JDBC URLs only change their host part.
    rds = {
      enabled = true
      databases = [
        { name = "student-db", endpoint = local.rds_endpoint },
        { name = "course-db", endpoint = local.rds_endpoint },
        { name = "department-db", endpoint = local.rds_endpoint },
        { name = "enrollment-db", endpoint = local.rds_endpoint },
      ]
    }
    student-db    = { enabled = false }
    course-db     = { enabled = false }
    department-db = { enabled = false }
    enrollment-db = { enabled = false }

    # --- Ingress / network -------------------------------------------------
    # Lab-friendly ALB: internet-facing (no NAT gateway budget), HTTP only
    # (no ACM cert without a DNS domain we can validate in the lab). Hit
    # the ALB hostname directly, or point Route 53 at it later.
    networkPolicy = {
      enabled                = true
      ingressNamespace       = ""
      ingressCidrBlocks      = [var.vpc_cidr]
      databaseCidrBlocks     = [var.vpc_cidr]
      observabilityNamespace = "observability"
    }

    # --- Storage ------------------------------------------------------------
    storageClass = var.storage_class

    # --- External Secrets -----------------------------------------------------
    # Disabled in the lab (no IRSA); enable on a real account, where the
    # values/eks/gl5-student.yaml IRSA role is provisionable.
    externalSecrets = {
      enabled = false
    }
  }
}

# ---------------------------------------------------------------------------
# Helm/Terraform integration.
#
#   Terraform resource              Provisioned by     Layer
#   ------------------------        -------------------- --------
#   aws_eks_cluster / node_group    aws provider          infra
#   aws_db_instance                 aws provider          infra
#   aws_ecr_repository              aws provider          infra
#   helm_release aws-lb-controller  helm provider         in-cluster platform
#   helm_release kube-prometheus-stack helm provider      observability
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

# Grafana admin password. Kept out of the repository and out of the plan
# output; read it with `terraform output -raw grafana_admin_password`.
resource "random_password" "grafana" {
  length  = 24
  special = false
}

# The umbrella chart uses file:// dependencies (frontend, keycloak,
# microservice, mysql) whose .tgz archives are git-ignored. They are packaged
# by `dependency_update = true` on helm_release.gl5_student below.

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
  # Chart 3.x is the current line and supports the EKS versions that are still
  # in standard support (the previous 1.x chart predates them).
  version = "3.6.2"
  timeout = 900

  set = [
    { name = "clusterName", value = aws_eks_cluster.gl5.name },
    { name = "region", value = var.aws_region },
    { name = "vpcId", value = aws_vpc.gl5.id },
    # The lab does not use IRSA. Host networking lets the controller reach
    # the node instance-role credentials through EC2 instance metadata.
    { name = "hostNetwork", value = "true" },
    # Required with hostNetwork, otherwise the webhook pods cannot resolve the
    # Kubernetes API through the cluster DNS.
    { name = "dnsPolicy", value = "ClusterFirstWithHostNet" },
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

# --- Observability (Prometheus + Grafana) -----------------------------------
# kube-prometheus-stack brings the operator, Prometheus, Grafana, kube-state-
# metrics and node-exporter. The application chart creates one ServiceMonitor
# per Spring service (see observability.serviceMonitor below) and the
# NetworkPolicies allow the observability namespace to scrape the Actuator
# endpoints.
#
# The release is installed before the application release so the
# monitoring.coreos.com CRDs exist when Helm applies the ServiceMonitors.
resource "helm_release" "kube_prometheus_stack" {
  count = var.enable_observability ? 1 : 0

  name             = "monitoring"
  repository       = "https://prometheus-community.github.io/helm-charts"
  chart            = "kube-prometheus-stack"
  version          = "92.14.1"
  namespace        = "observability"
  create_namespace = true
  timeout          = 900

  # The chart is large (operator, Prometheus, Grafana, node-exporter,
  # kube-state-metrics). Do not block `terraform apply` on every pod becoming
  # Ready: watch `kubectl -n observability get pods -w` instead.
  wait = false

  values = [yamlencode(local.observability_values)]

  depends_on = [helm_release.aws_lb_controller]
}

# The dashboard already used by the local Compose stack. Grafana's sidecar
# discovers ConfigMaps labeled grafana_dashboard=1 in all namespaces and
# provisions the JSON automatically.
resource "kubernetes_config_map_v1" "grafana_spring_services" {
  count = var.enable_observability ? 1 : 0

  metadata {
    name      = "gl5-g4-spring-services"
    namespace = "observability"
    labels = {
      grafana_dashboard = "1"
    }
  }

  data = {
    "gl5-g4-spring-services.json" = file("${path.module}/../../observability/grafana/dashboards/spring-services.json")
  }

  depends_on = [helm_release.kube_prometheus_stack]
}

# --- The application (gl5-student umbrella chart) ---------------------------
# The release uses one self-contained values document (local.app_values).
# The repo's values/eks/gl5-student.yaml is intentionally NOT merged: it is a
# template full of <...> placeholders that would leak into the rendered
# resources (Helm deep-merges maps key-by-key).
resource "helm_release" "gl5_student" {
  name             = "gl5-student"
  chart            = "${path.module}/../helm/umbrella/gl5-student"
  namespace        = "gl5-student"
  create_namespace = true
  timeout          = 900

  # Package the umbrella chart's file:// dependencies (charts/*.tgz, which are
  # git-ignored) before Helm loads it. The Helm provider loads/validates the
  # chart during PLAN, so a plan-time `helm dependency update` is required:
  # without it a fresh checkout fails with "Found in Chart.yaml, but missing in
  # charts/ directory". This also replaces the old null_resource: dependencies
  # are refreshed on every plan, so sub-chart edits are always picked up.
  dependency_update = true

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
    helm_release.aws_lb_controller,
    helm_release.kube_prometheus_stack,
    aws_db_instance.gl5,
  ]
}

locals {
  rds_endpoint = aws_db_instance.gl5.address

  # Keycloak is reached by the browser through the frontend's /auth relay, so
  # its published issuer must be the public URL, not the in-cluster Service.
  # On the first apply (public_hostname = "") the internal URL keeps Keycloak
  # and the gateway consistent; the second apply switches both to the ALB.
  public_base_url = var.public_hostname == "" ? "http://keycloak:8080" : "${var.public_scheme}://${var.public_hostname}/auth"
  keycloak_issuer = "${local.public_base_url}/realms/gl5"

  # ALB annotations shared by the Grafana and Prometheus Ingresses. The
  # group.name matches the frontend Ingress, so both UIs are served by the
  # same ALB under /grafana and /prometheus instead of creating a second
  # load balancer.
  monitoring_alb_annotations = {
    "alb.ingress.kubernetes.io/scheme"       = "internet-facing"
    "alb.ingress.kubernetes.io/target-type"  = "ip"
    "alb.ingress.kubernetes.io/listen-ports" = "[{\"HTTP\": 80}]"
    "alb.ingress.kubernetes.io/group.name"   = "gl5-student"
    # Several Ingresses share this group. The frontend has a catch-all "/"
    # rule, so the monitoring rules must be evaluated first. Lower number =
    # higher priority (the frontend Ingress uses group.order 100).
    "alb.ingress.kubernetes.io/group.order"      = "10"
    "alb.ingress.kubernetes.io/healthcheck-port" = "traffic-port"
    "alb.ingress.kubernetes.io/success-codes"    = "200"
  }

  observability_values = {
    fullnameOverride = "monitoring"

    # The lab has two t3.large nodes. Keep Alertmanager out and skip the
    # control-plane scrapers that EKS does not expose to the cluster.
    alertmanager          = { enabled = false }
    kubeEtcd              = { enabled = false }
    kubeControllerManager = { enabled = false }
    kubeScheduler         = { enabled = false }
    kubeProxy             = { enabled = false }

    grafana = {
      adminUser     = "admin"
      adminPassword = random_password.grafana.result

      ingress = {
        enabled          = true
        ingressClassName = "alb"
        annotations = merge(local.monitoring_alb_annotations, {
          "alb.ingress.kubernetes.io/healthcheck-path" = "/grafana/api/health"
        })
        hosts    = []
        path     = "/grafana"
        pathType = "Prefix"
      }

      # Grafana is served under /grafana by the shared ALB. A relative
      # root_url works for any ALB hostname, so the UI is reachable
      # immediately on the first apply (before public_hostname is known).
      "grafana.ini" = {
        server = {
          root_url            = "/grafana/"
          serve_from_sub_path = true
        }
      }

      resources = {
        requests = { cpu = "50m", memory = "128Mi" }
        limits   = { cpu = "500m", memory = "512Mi" }
      }
    }

    prometheus = {
      ingress = {
        enabled          = true
        ingressClassName = "alb"
        annotations = merge(local.monitoring_alb_annotations, {
          "alb.ingress.kubernetes.io/healthcheck-path" = "/prometheus/-/healthy"
        })
        hosts    = []
        paths    = ["/prometheus"]
        pathType = "Prefix"
      }

      service = { type = "ClusterIP" }

      prometheusSpec = merge(
        {
          routePrefix = "/prometheus"
          retention   = "6h"

          # The application chart publishes ServiceMonitors in the gl5-student
          # namespace. An empty selector + all namespaces means Prometheus
          # discovers them without requiring a Helm release label on each one.
          serviceMonitorSelectorNilUsesHelmValues = false
          serviceMonitorSelector                  = {}
          serviceMonitorNamespaceSelector         = {}

          resources = {
            requests = { cpu = "100m", memory = "512Mi" }
            limits   = { cpu = "1", memory = "2Gi" }
          }
        },
        var.public_hostname == "" ? {} : {
          externalUrl = "${var.public_scheme}://${var.public_hostname}/prometheus"
        }
      )
    }
  }

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
      image  = { repository = "${local.ecr_domain}/gl5-g4-api-gateway", tag = var.image_tag }
      secret = { create = true, existing = "" }
      env = {
        # The browser gets tokens from the public /auth URL; the gateway
        # validates that issuer. JWKS stays on the internal Service because
        # the pod egress NetworkPolicy does not allow the public ALB.
        KEYCLOAK_ISSUER_URI = local.keycloak_issuer
        JWK_SET_URI         = "http://keycloak:8080/realms/gl5/protocol/openid-connect/certs"
      }
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
      # Must match the API Gateway issuer and the URL the browser reaches via
      # the frontend /auth relay.
      hostname = local.public_base_url
      # Same ephemeral database strategy as Minikube: realm is re-imported
      # on restart, good for the demo. RDS-backed Keycloak DB is the next step.
      db          = { vendor = "dev-file" }
      persistence = { enabled = false }
    }
    frontend = {
      # The real Angular application, built by `docker compose build
      # frontend-service`. A stock nginx image has no /api and /auth proxy
      # configuration and fails the /health probe.
      image = { repository = "${local.ecr_domain}/gl5-g4-frontend-service", tag = var.image_tag }

      runtime = {
        # The lab exposes the ALB over plain HTTP (no domain to validate an
        # ACM certificate). Web Crypto is unavailable on a non-secure origin,
        # so the Angular app selects the implicit flow when pkceMethod is
        # false (see AuthService.init). The realm client therefore enables
        # implicitFlowEnabled and does not require PKCE. Restore S256 + the
        # client attribute once the ALB is behind HTTPS.
        pkceMethod = false
      }

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
          # Evaluated after the /grafana and /prometheus rules of the
          # monitoring Ingresses (they use group.order 10).
          "alb.ingress.kubernetes.io/group.order" = "100"
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
      enabled = true
      # The ALB uses target-type=ip, so requests reach the frontend pods with
      # the *client* source address (AWS preserves it). Restricting this to
      # the VPC CIDR would let the ALB health check pass while blocking every
      # real visitor. The ALB security group is the perimeter in this lab;
      # narrow this to CloudFront/office ranges for a production deployment.
      ingressNamespace       = ""
      ingressCidrBlocks      = ["0.0.0.0/0"]
      databaseCidrBlocks     = [var.vpc_cidr]
      observabilityNamespace = "observability"
    }

    # --- Observability ------------------------------------------------------
    # The monitoring release installed above selects every ServiceMonitor
    # (serviceMonitorSelectorNilUsesHelmValues=false), so the app namespace
    # only has to publish one ServiceMonitor per Spring service.
    observability = {
      serviceMonitor = {
        enabled       = var.enable_observability
        interval      = "30s"
        scrapeTimeout = "10s"
      }
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

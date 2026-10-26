# Terraform — Learner Lab EKS stack

Terraform owns the AWS infrastructure and drives Helm for the application.
Structure:

```text
deploy/terraform/
├── versions.tf    providers (aws, helm, kubernetes, random) + backend
├── variables.tf   lab-tuned defaults (t3.large, db.t3.micro, us-east-1)
├── main.tf        identity + pre-created LabRole lookup
├── vpc.tf         VPC + 2 public subnets (NO NAT gateway: budget)
├── eks.tf         EKS cluster + managed node group (lab IAM roles)
├── ecr.tf         7 ECR repos for the app images
├── rds.tf         single MySQL instance + node-security-group ingress
├── helm.tf        helm/kubernetes providers + ALB controller + app release
└── outputs.tf     kubectl config cmd, RDS endpoint, ECR URLs, db password
```

## Learner Lab constraints honoured

| Lab rule | Design choice here |
|---|---|
| Region us-east-1 or us-west-2 | `aws_region = us-east-1` |
| Cannot create IAM roles | Data sources reference the pre-created `LabRole` (cluster, nodes, and ALB controller) |
| EKS nodes nano..large | `t3.large` |
| RDS nano..medium, gp2, monitoring off | `db.t3.micro`, gp2, low budget |
| 9 concurrent EC2 per region | 2 nodes in the node group |
| No Route53 domain registration | ALB is reached by its hostname directly |
| Budget: kill NAT / RDS / EKS nightly | No NAT gateway; `terraform destroy` between sessions |

## How Terraform and Helm share the work

1. `aws_eks_cluster` + `aws_eks_node_group` create the cluster (Terraform).
2. `helm`/`kubernetes` providers authenticate with `aws eks get-token` (exec).
3. `helm_release.aws_lb_controller` installs the ALB controller (Helm, driven by Terraform).
4. `helm_release.gl5_student` deploys the umbrella chart in `deploy/helm/umbrella/gl5-student`
   using the self-contained lab values in `helm.tf` (`locals.app_values`).
   NOTE: the repo's `values/eks/gl5-student.yaml` is NOT merged here — Helm
   deep-merges maps key-by-key, so its `<...>` placeholders would leak into
   the rendered Ingress. All lab keys live in `locals.app_values`.
5. `null_resource.helm_deps` runs `helm dependency update` on any Chart.yaml change.

## Run it

```bash
cd deploy/terraform
terraform init
terraform plan -out plan.tfplan
terraform apply plan.tfplan            # ~15 min: EKS is slow

# Push the locally built Spring services to ECR (run from the repository root).
# The compose build creates these five local image names.
REGION="${AWS_REGION:-us-east-1}"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGISTRY="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com"

aws ecr get-login-password --region "$REGION" |
  docker login --username AWS --password-stdin "$REGISTRY"

for service in api-gateway student-service course-service department-service enrollment-service; do
  image="gl5-g4-$service"
  docker tag "$image:local" "$REGISTRY/$image:latest"
  docker push "$REGISTRY/$image:latest"
done

# Keycloak and the Nginx frontend use their public upstream images; no local
# ECR image needs to be pushed for them.

# then follow the pods (they were deployed with helm; they start once the
# images exist — ImagePullBackOff before that is expected)
kubectl get pods -n gl5-student -w
```

The default configuration uses the standard Learner Lab `LabRole` for both the
EKS control plane and worker nodes. If your account has a dedicated control
plane role, pass it explicitly:

```bash
terraform plan -var='cluster_role_name=MyEksClusterRole' -out plan.tfplan
```

## Verify (same smoke tests as Minikube)

```bash
kubectl -n gl5-student get pods
kubectl -n gl5-student get ingress          # ALB hostname here
INGRESS=$(kubectl -n gl5-student get ingress -o jsonpath='{.items[0].status.loadBalancer.ingress[0].hostname}')
curl -s -o /dev/null -w '%{http_code}\n' "http://$INGRESS/"
```

## Tear down (IMPORTANT for the budget)

```bash
kubectl delete namespace gl5-student        # clears PVCs, then:
terraform destroy                            # EKS + RDS + ALB have to go
```

EKS control plane + 2× t3.large nodes + ALB + RDS ≈ $0.45/h ≈ **$11/day**.
Destroy between sessions; the stack is fully reproducible via `terraform apply`.

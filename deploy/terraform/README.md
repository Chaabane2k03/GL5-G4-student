# AWS EKS Deployment with Terraform & Helm

Comprehensive Terraform and Helm automation for deploying the **GL5-G4 Student Management Platform** on Amazon Elastic Kubernetes Service (EKS).

Optimized specifically for the **AWS Academy Learner Lab** environment (leveraging the pre-created `LabRole` and budget-conscious resources without NAT Gateways), while remaining adaptable to standard AWS production accounts.

---

## Table of Contents

- [Overview & Architecture](#overview--architecture)
- [Project Structure](#project-structure)
- [0. Prerequisites](#0-prerequisites)
- [1. Phase 1: Create ECR Repositories](#1-phase-1-create-ecr-repositories)
- [2. Phase 2: Build & Push Application Images](#2-phase-2-build--push-application-images)
- [3. Phase 3: Provision AWS Stack & Deploy Application](#3-phase-3-provision-aws-stack--deploy-application)
- [4. Phase 4: Configure ALB Hostname & Ingress Routing](#4-phase-4-configure-alb-hostname--ingress-routing)
- [5. Phase 5: Observability & Monitoring](#5-phase-5-observability--monitoring)
- [6. Phase 6: Verification & End-to-End Testing](#6-phase-6-verification--end-to-end-testing)
- [7. Day-2 Operations](#7-day-2-operations)
  - [Updating Application Services](#updating-application-services)
  - [Updating Keycloak](#updating-keycloak)
- [8. Teardown & Cost Management](#8-teardown--cost-management)
- [Troubleshooting Matrix](#troubleshooting-matrix)
- [Architecture Notes & Design Caveats](#architecture-notes--design-caveats)

---

## Overview & Architecture

Terraform provisions the foundational AWS infrastructure (VPC, EKS Cluster, Node Group, RDS MySQL, and ECR) and bootstraps the Kubernetes application using Helm.

```text
                                Internet
                                   │
                                   ▼
                   ┌────────────────────────────────┐
                   │   AWS Application Load Balancer│
                   │             (ALB)              │
                   └───────────────┬────────────────┘
                                   │
       ┌───────────────────────────┼───────────────────────────┐
       │ / (frontend)              │ /auth (Keycloak)          │ /prometheus, /grafana
       ▼                           ▼                           ▼
┌──────────────┐            ┌──────────────┐            ┌──────────────────────┐
│   Angular    │            │   Keycloak   │            │ kube-prometheus-stack│
│   Frontend   │            │   (Realm     │            │(Prometheus & Grafana)│
│    (Nginx)   │            │  auto-import)│            └──────────────────────┘
└──────┬───────┘            └──────┬───────┘
       │ /api                      │
       ▼                           │ JWKS Validation
┌──────────────┐                   │
│ API Gateway  │◄──────────────────┘
└──────┬───────┘
       │ Kubernetes Cluster DNS (deny-by-default NetworkPolicies)
       ├─────────────────┬──────────────────┬─────────────────┐
       ▼                 ▼                  ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  Department  │  │    Course    │  │   Student    │  │  Enrollment  │
│   Service    │  │   Service    │  │   Service    │  │   Service    │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                  │                 │
       └─────────────────┴────────┬─────────┴─────────────────┘
                                  │ ExternalName Service
                                  ▼
                     ┌───────────────────────────┐
                     │     AWS RDS MySQL         │
                     │ (Single instance, 4 dbs)  │
                     └───────────────────────────┘
```

### Key Architectural Highlights

- **Umbrella Helm Chart (`deploy/helm/umbrella/gl5-student`)**:
  - Deploys the Angular frontend behind an internet-facing **AWS ALB**.
  - Deploys the API Gateway and the four Spring Boot business microservices.
  - Deploys **Keycloak 26** with automatic realm importing on startup.
  - Connects to an **Amazon RDS MySQL** multi-schema instance (no in-cluster MySQL StatefulSets).
  - Enforces cluster-wide **NetworkPolicies** in deny-by-default mode.
- **Service Discovery & Config**:
  - Config Server and Eureka are replaced on Kubernetes by native **Kubernetes DNS**, **ConfigMaps/Secrets**, and the `kubernetes` Spring profile.
- **Observability**:
  - Installs **kube-prometheus-stack** in the `observability` namespace.
  - Automatically scrapes Actuator endpoints via per-service `ServiceMonitor` resources and exposes Prometheus (`/prometheus/`) and Grafana (`/grafana/`) on the shared ALB.

---

## Project Structure

```text
deploy/terraform/
├── versions.tf      # Required providers (aws, helm, kubernetes, random) & backend
├── variables.tf     # Lab-tuned defaults (t3.large, db.t3.micro, us-east-1, standard support K8s)
├── main.tf          # AWS identity & pre-created LabRole data lookup
├── vpc.tf           # VPC + 2 public subnets (budget-friendly: zero NAT Gateway costs)
├── eks.tf           # EKS cluster + managed node group configured for LabRole
├── ecr.tf           # 6 ECR repositories for containerized services
├── rds.tf           # Single MySQL RDS instance + node security group ingress
├── helm.tf          # Helm/Kubernetes providers, AWS ALB controller, observability, & app release
└── outputs.tf       # Kubectl configuration helper, RDS endpoint, ECR URLs, credentials
```

---

## 0. Prerequisites

| Tool | Version Requirement | Purpose |
|---|---|---|
| **AWS CLI** | `v2.x` | Authenticating with AWS and managing EKS kubeconfig |
| **Terraform** | `>= 1.9` | Infrastructure as Code orchestration |
| **Helm** | `>= 3.16` | Kubernetes package management |
| **kubectl** | Matching cluster version (1.31+) | Kubernetes cluster management |
| **Docker Desktop** | Latest (Linux engine) | Container builds and pushes |
| **Java / Maven** | OpenJDK 17+, Maven 3.9+ | *(Optional)* Only if building outside Docker |

### 0.1 Configure AWS Credentials

> [!TIP]
> When the deployment is run from Jenkins, these credentials come from
> `jenkins-nexus-docker/.env` (Compose injects them into the container) and the
> `Deploy to AWS` stage executes phases 1 to 4.2 automatically. See
> [`JENKINS.md`](../../JENKINS.md#8-aws-credentials-and-terraform-deployment).
> The manual commands below remain the reference for local runs.

Learner Lab credentials expire periodically. Export your temporary credentials before running any commands.

<details open>
<summary><b>Linux / macOS (Bash)</b></summary>

```bash
export AWS_ACCESS_KEY_ID="ASIA..."
export AWS_SECRET_ACCESS_KEY="..."
export AWS_SESSION_TOKEN="..."
export AWS_REGION="us-east-1"

# Verify credentials
aws sts get-caller-identity
```
</details>

<details>
<summary><b>Windows (PowerShell)</b></summary>

```powershell
$env:AWS_ACCESS_KEY_ID     = "ASIA..."
$env:AWS_SECRET_ACCESS_KEY = "..."
$env:AWS_SESSION_TOKEN     = "..."
$env:AWS_REGION            = "us-east-1"

# Verify credentials
aws sts get-caller-identity
```
</details>

### 0.2 Initialize Terraform

Navigate to `deploy/terraform` and initialize provider plugins:

```bash
cd deploy/terraform
terraform init
```

> [!NOTE]
> The umbrella chart (`deploy/helm/umbrella/gl5-student`) declares `file://`
> sub-chart dependencies whose `.tgz` archives are git-ignored. Terraform
> packages them automatically (`dependency_update = true` on
> `helm_release.gl5_student`, which runs `helm dependency update` at plan
> time), so no manual `helm dependency update` is needed before
> `terraform plan`/`apply`. Running it manually is still fine and does not
> change the plan.
>
> The default configuration uses `us-east-1`, node instance type `t3.large`, RDS instance `db.t3.micro`, and Kubernetes version `1.36`. Ensure your chosen Kubernetes version is under **standard support** to avoid an additional `$0.60/hour` control plane surcharge for extended support.

---

## 1. Phase 1: Create ECR Repositories

Because pod deployment expects images to exist in ECR, target the creation of the 6 ECR repositories first.

```bash
terraform apply -target "aws_ecr_repository.app" -auto-approve
```

> [!TIP]
> Keep the quotes around `"aws_ecr_repository.app"`: Windows PowerShell 5.1 interprets unquoted dots (`-target=aws_ecr_repository.app`) unexpectedly, causing Terraform to reject the argument.

### Authenticate Docker to ECR

<details open>
<summary><b>Linux / macOS (Bash)</b></summary>

```bash
REGION="us-east-1"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGISTRY="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com"

aws ecr get-login-password --region "$REGION" | \
  docker login --username AWS --password-stdin "$REGISTRY"
```
</details>

<details>
<summary><b>Windows (PowerShell)</b></summary>

```powershell
$REGION     = "us-east-1"
$ACCOUNT_ID = aws sts get-caller-identity --query Account --output text
$REGISTRY   = "$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com"

aws ecr get-login-password --region $REGION | `
  docker login --username AWS --password-stdin $REGISTRY
```
</details>

---

## 2. Phase 2: Build & Push Application Images

From the **repository root directory**, build the 6 services and push them to ECR:

<details open>
<summary><b>Linux / macOS (Bash)</b></summary>

```bash
cd ../..

# 1. Build local container images
docker compose build \
  api-gateway student-service course-service department-service \
  enrollment-service frontend-service

# 2. Tag and push to Amazon ECR
for svc in api-gateway student-service course-service \
           department-service enrollment-service frontend-service; do
  image="gl5-g4-$svc"
  docker tag "$image:local" "$REGISTRY/$image:latest"
  docker push "$REGISTRY/$image:latest"
done
```
</details>

<details>
<summary><b>Windows (PowerShell)</b></summary>

```powershell
cd ../..

# 1. Build local container images
docker compose build `
  api-gateway student-service course-service department-service `
  enrollment-service frontend-service

# 2. Tag and push to Amazon ECR
foreach ($svc in "api-gateway","student-service","course-service",
                 "department-service","enrollment-service","frontend-service") {
  $image = "gl5-g4-$svc"
  docker tag "$image`:local" "$REGISTRY/$image`:latest"
  docker push "$REGISTRY/$image`:latest"
}
```
</details>

> [!IMPORTANT]
> `frontend-service` is the production Angular image containing the customized Nginx reverse proxy configuration for `/api`, `/auth`, and `/health`. Do not replace it with a generic Nginx image.

---

## 3. Phase 3: Provision AWS Stack & Deploy Application

Deploy the VPC, EKS Cluster, Node Group, RDS MySQL instance, AWS Load Balancer Controller, monitoring stack, and the umbrella Helm chart:

<details open>
<summary><b>Linux / macOS (Bash)</b></summary>

```bash
cd deploy/terraform
terraform apply -auto-approve

# Configure kubectl to point to the new cluster
aws eks update-kubeconfig --name gl5-g4 --region us-east-1

# Verify cluster connectivity and worker nodes
kubectl config current-context
kubectl get nodes
```
</details>

<details>
<summary><b>Windows (PowerShell)</b></summary>

```powershell
cd deploy/terraform
terraform apply -auto-approve

# Configure kubectl to point to the new cluster
aws eks update-kubeconfig --name gl5-g4 --region us-east-1

# Verify cluster connectivity and worker nodes
kubectl config current-context
kubectl get nodes
```
</details>

> [!NOTE]
> This phase takes **15 to 25 minutes** to complete (EKS control plane, node instances, and RDS provisioning require several minutes each). Helm releases are executed with `wait = false`, so Terraform will complete before every pod is fully Ready.

### Monitor Deployment Progress

Watch the application pods in the `gl5-student` namespace:

```bash
kubectl -n gl5-student get pods -w
```

**Expected Pod Inventory**:
- `frontend` (2 replicas, 1 container each)
- `api-gateway` (1 replica)
- `keycloak` (1 replica, takes 1–2 minutes to import the realm and pass readiness checks)
- Business microservices: `course-service`, `department-service`, `enrollment-service`, `student-service`
- External database services: `course-db`, `department-db`, `enrollment-db`, `student-db` (Kubernetes `ExternalName` services pointing to RDS; no in-cluster DB pods)

---

## 4. Phase 4: Configure ALB Hostname & Ingress Routing

The public AWS ALB hostname is assigned dynamically after Ingress reconciliation. A second quick apply aligns Keycloak's OIDC issuer and the API Gateway with this public URL.

### 4.1 Wait for ALB DNS and Apply Configuration

<details open>
<summary><b>Linux / macOS (Bash)</b></summary>

```bash
ALB=$(kubectl -n gl5-student get ingress frontend \
  -o jsonpath="{.status.loadBalancer.ingress[0].hostname}")

while [ -z "$ALB" ]; do
  echo "Waiting for ALB hostname assignment..."
  sleep 10
  ALB=$(kubectl -n gl5-student get ingress frontend \
    -o jsonpath="{.status.loadBalancer.ingress[0].hostname}")
done

echo "ALB Hostname: $ALB"
terraform apply -auto-approve -var "public_hostname=$ALB"
```
</details>

<details>
<summary><b>Windows (PowerShell)</b></summary>

```powershell
$ALB = kubectl -n gl5-student get ingress frontend `
  -o jsonpath="{.status.loadBalancer.ingress[0].hostname}"

while (-not $ALB) {
  Write-Host "Waiting for ALB hostname assignment..."
  Start-Sleep -Seconds 10
  $ALB = kubectl -n gl5-student get ingress frontend `
    -o jsonpath="{.status.loadBalancer.ingress[0].hostname}"
}

Write-Host "ALB Hostname: $ALB"
terraform apply -auto-approve -var "public_hostname=$ALB"
```
</details>

> [!WARNING]
> If you do not pass `public_hostname`, subsequent applies will fall back to the empty default and revert Keycloak and API Gateway to the internal `http://keycloak:8080` issuer.
> To persist this value across future runs, store it in `deploy/terraform/terraform.tfvars` (git-ignored):
> ```hcl
> public_hostname = "k8s-gl5student-1234567890-1234567890.us-east-1.elb.amazonaws.com"
> ```

### 4.2 Wait for Rollouts

```bash
kubectl -n gl5-student rollout status deployment/keycloak
kubectl -n gl5-student rollout status deployment/api-gateway
```

### 4.3 Access the Application

Open the public application URL in your browser:

```bash
# Linux
xdg-open "http://$ALB/"

# macOS
open "http://$ALB/"

# Windows (PowerShell)
Start-Process "http://$ALB/"
```

#### Pre-configured Test Accounts

| Username | Password | Assigned Role | Description |
|---|---|---|---|
| `admin` | `admin` | `ADMIN` | Full administrative access |
| `teacher` | `teacher` | `TEACHER` | Faculty permissions |
| `student` | `student` | `STUDENT` | Standard student access |

- **Keycloak Master Administration Console**:
  - URL: `http://$ALB/auth/admin/`
  - Credentials: `admin` / `admin-admin-password`

<details>
<summary><b>Deep Dive: HTTP vs HTTPS & Web Crypto Shims in Learner Lab</b></summary>

The Learner Lab environment lacks a public routable domain and ACM certificate, making the ALB HTTP-only. Modern browsers disable the Web Crypto API (`crypto.subtle`) in insecure contexts, preventing standard PKCE S256 computation.

- The Angular application sets `pkceMethod: false` via `/config.json`, while strictly retaining the **Authorization Code flow**. This ensures a valid *refresh token* is issued, allowing `keycloak-js` to silently renew tokens via its HTTP interceptor (`updateToken()`).
- Additionally, `keycloak-js` 26 generates OAuth `state` using `crypto.randomUUID()`. Because `randomUUID()` is disabled on plain HTTP, a lightweight shim (`frontend-service/src/app/core/auth/insecure-context-crypto.ts`) synthesizes UUIDs via `crypto.getRandomValues` (which is permitted over plain HTTP).
- In a production deployment with ACM + HTTPS, set `runtime.pkceMethod = S256` and remove the crypto shim.
</details>

---

## 5. Phase 5: Observability & Monitoring

Terraform installs `kube-prometheus-stack` into the `observability` namespace, with the application chart contributing a `ServiceMonitor` for each Spring Boot Actuator endpoint.

```bash
kubectl -n observability get pods -w
```

### Accessing Dashboards

Prometheus and Grafana are routed via the application ALB through the shared ingress group:

| Service | Access URL | Credentials |
|---|---|---|
| **Prometheus** | `http://$ALB/prometheus/` | Unauthenticated (Lab mode) |
| **Grafana** | `http://$ALB/grafana/` | User: `admin`<br>Password: `terraform output -raw grafana_admin_password` |

- **Pre-provisioned Dashboard**: Navigate in Grafana to **GL5-G4 / GL5-G4 Spring Services** (imported automatically from `observability/grafana/dashboards/spring-services.json`).
- **Scrape Target Inspection**:
  Verify active targets in Prometheus under **Status → Targets**, or via kubectl:
  ```bash
  kubectl -n gl5-student get servicemonitor
  ```

> [!NOTE]
> Prometheus uses `emptyDir` storage in this lab configuration (no EBS CSI driver). Monitoring history is ephemeral and resets upon pod restarts. Disable observability to save resources with `-var="enable_observability=false"`.

---

## 6. Phase 6: Verification & End-to-End Testing

### 6.1 Check Resources

```bash
kubectl -n gl5-student get pods,svc,ingress
kubectl -n gl5-student get events --sort-by=.lastTimestamp
```

### 6.2 Test Endpoints via Frontend API Gateway Relay

<details open>
<summary><b>Linux / macOS (Bash + curl + jq)</b></summary>

```bash
# 1. Obtain an access token using Resource Owner Password Credentials grant
TOKEN=$(curl -s -X POST \
  "http://$ALB/auth/realms/gl5/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "grant_type=password" \
  --data-urlencode "client_id=api-gateway" \
  --data-urlencode "username=admin" \
  --data-urlencode "password=admin" | jq -r .access_token)

# 2. Query each backend service through the frontend reverse proxy
for path in \
  "/api/department/api/departments" \
  "/api/course/api/courses" \
  "/api/student/students/getAllStudents" \
  "/api/enrollment/Enrollment/getAllEnrollment"; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://$ALB$path" \
    -H "Authorization: Bearer $TOKEN")
  echo "$path -> HTTP $code"
done
```
</details>

<details>
<summary><b>Windows (PowerShell)</b></summary>

```powershell
# 1. Obtain an access token
$TOKEN = (Invoke-RestMethod `
  -Method Post `
  -Uri "http://$ALB/auth/realms/gl5/protocol/openid-connect/token" `
  -ContentType "application/x-www-form-urlencoded" `
  -Body @{
    grant_type = "password"
    client_id  = "api-gateway"
    username   = "admin"
    password   = "admin"
  }).access_token

# 2. Query each backend service
foreach ($path in @(
  "/api/department/api/departments",
  "/api/course/api/courses",
  "/api/student/students/getAllStudents",
  "/api/enrollment/Enrollment/getAllEnrollment"
)) {
  $r = Invoke-WebRequest -Uri "http://$ALB$path" `
    -Headers @{ Authorization = "Bearer $TOKEN" } -UseBasicParsing
  "$path -> HTTP $($r.StatusCode)"
}
```
</details>

> [!TIP]
> **Transient 503 errors during warm-up**: Each gateway route uses a Resilience4j circuit breaker. Calls made while pods are initializing are treated as failures. Once open, the breaker waits `10s` before probing. A single initial `503` is expected; retry after 10–15 seconds rather than redeploying.
>
> Access **Swagger UI** directly at `http://$ALB/api/swagger-ui.html`.

---

## 7. Day-2 Operations

### Updating Application Services

To roll out new code using git commit SHA tags:

<details open>
<summary><b>Linux / macOS (Bash)</b></summary>

```bash
TAG=$(git rev-parse --short HEAD)

for svc in api-gateway student-service course-service \
           department-service enrollment-service frontend-service; do
  image="gl5-g4-$svc"
  docker tag "$image:local" "$REGISTRY/$image:$TAG"
  docker push "$REGISTRY/$image:$TAG"
done

terraform apply -auto-approve -var "image_tag=$TAG" -var "public_hostname=$ALB"
```
</details>

<details>
<summary><b>Windows (PowerShell)</b></summary>

```powershell
$TAG = (git rev-parse --short HEAD)

foreach ($svc in "api-gateway","student-service","course-service",
                 "department-service","enrollment-service","frontend-service") {
  $image = "gl5-g4-$svc"
  docker tag "$image`:local" "$REGISTRY/$image`:$TAG"
  docker push "$REGISTRY/$image`:$TAG"
}

terraform apply -auto-approve -var "image_tag=$TAG" -var "public_hostname=$ALB"
```
</details>

### Updating Keycloak

Keycloak uses an independent version tag (`keycloak_image_tag`). To update:

```bash
KC_TAG="26.8.1"
docker pull "quay.io/keycloak/keycloak:$KC_TAG"
docker tag  "quay.io/keycloak/keycloak:$KC_TAG" "$REGISTRY/gl5-g4-keycloak:$KC_TAG"
docker push "$REGISTRY/gl5-g4-keycloak:$KC_TAG"

terraform apply -auto-approve -var "keycloak_image_tag=$KC_TAG" -var "public_hostname=$ALB"
```

---

## 8. Teardown & Cost Management

Always tear down resources when not in use. Running costs in the Learner Lab average **$0.35–$0.45/hour** (~$8–$11/day).

### 8.1 Graceful Teardown

First uninstall the Helm application release, then destroy the Terraform stack:

```bash
# 1. Remove Helm release first so AWS load balancers detach cleanly
helm uninstall gl5-student -n gl5-student

# 2. Destroy Terraform managed infrastructure
terraform destroy -auto-approve
```

### 8.2 Clean Residual VPC Security Groups

> [!WARNING]
> The AWS Load Balancer Controller dynamically creates security groups (`k8s-traffic-*`, `k8s-<stack>-*`) that are unmanaged by Terraform. If these security groups remain attached, `terraform destroy` will fail on VPC deletion with `DependencyViolation`.
>
> If this occurs, clean the residual security groups using the following script:

<details open>
<summary><b>Linux / macOS (Bash)</b></summary>

```bash
VPC=$(terraform state show -no-color aws_vpc.gl5 | \
  grep -E '^[[:space:]]*id[[:space:]]*=' | head -n1 | cut -d'"' -f2)

if [ -n "$VPC" ]; then
  aws ec2 describe-security-groups --filters "Name=vpc-id,Values=$VPC" \
    --query "SecurityGroups[?GroupName!='default'].GroupId" --output text | \
    tr '\t' '\n' | grep -v '^None$' | \
    xargs -r -n1 aws ec2 delete-security-group --group-id

  aws ec2 delete-vpc --vpc-id "$VPC"
  terraform state rm aws_vpc.gl5
fi
```
</details>

<details>
<summary><b>Windows (PowerShell)</b></summary>

```powershell
$VPC = terraform state show -no-color aws_vpc.gl5 | Select-String 'id\s+=' |
  ForEach-Object { ($_.Line -split '=')[1].Trim().Trim('"') }

if ($VPC) {
  aws ec2 describe-security-groups --filters "Name=vpc-id,Values=$VPC" `
    --query "SecurityGroups[?GroupName!='default'].GroupId" --output text |
    ForEach-Object { $_ -split '\s+' } |
    ForEach-Object { aws ec2 delete-security-group --group-id $_ }

  aws ec2 delete-vpc --vpc-id $VPC
  terraform state rm aws_vpc.gl5
}
```
</details>

> [!NOTE]
> If your lab session times out during destruction, AWS will return `explicit deny in an identity-based policy: ... voc-cancel-cred`. This indicates that your lab session ended and credentials were automatically revoked. Restart the lab, export fresh credentials, and rerun the destroy command.

---

## Troubleshooting Matrix

| Category | Symptom | Root Cause | Recommended Fix |
|---|---|---|---|
| **Images & Pods** | `ImagePullBackOff` / `ErrImagePull` | Missing image tag in ECR or node IAM permission issue | Check `kubectl -n gl5-student describe pod <pod>`. Verify the image was pushed to ECR under the expected repository name. |
| **Scheduling** | Pods stuck in `Pending` | Insufficient CPU/Memory on worker nodes | Check `kubectl describe node`. Reduce replica count or upgrade `node_instance_type`. |
| **Ingress** | AWS ALB never provisions | Subnet tagging missing or controller role failure | Verify `kubernetes.io/role/elb=1` tag is present on public subnets; inspect controller logs via `kubectl -n kube-system logs deploy/aws-load-balancer-controller`. |
| **Authentication** | Login redirects to `http://keycloak:8080` | Phase 4 not completed with public ALB hostname | Run `terraform apply -var="public_hostname=$ALB"` and await Keycloak rollout completion. |
| **Authentication** | Keycloak in `CrashLoopBackOff` | Deprecated Keycloak 25 configuration options used | Keycloak 26 supports only `KC_HOSTNAME` and `KC_PROXY_HEADERS`. Remove flags like `hostname-strict` or `proxy`. |
| **Authentication** | `/auth` returns `502 Bad Gateway` | Keycloak realm import in progress or container starting | Check `kubectl -n gl5-student logs deploy/keycloak` and verify pod readiness probe. |
| **Authentication** | POST to `/auth` returns `502` | Nginx header buffer overflow from large `Set-Cookie` | Ensure `proxy_buffer_size 16k` and `proxy_buffers 8 16k` are set in the frontend Nginx config. |
| **Authentication** | Login redirect loop | Stale ALB hostname cached or omitted during re-apply | Re-read the current Ingress hostname and execute `terraform apply -var="public_hostname=$ALB"`. |
| **Authentication** | "Session administrative expirée" | Authorization Code flow missing refresh token | Ensure `cursus-frontend` uses `flow: 'standard'` with `pkceMethod: false` over HTTP. |
| **Configuration** | Changes to `realm.json.tpl` not reflected | Realm database is in-memory; import occurs only on init | Delete the Keycloak pod to trigger re-import of the realm template upon pod startup. |
| **API Gateway** | HTTP `401 Unauthorized` on `/api/**` | Issuer URL mismatch | Verify token `iss` matches `KEYCLOAK_ISSUER_URI` on the gateway. `JWK_SET_URI` must remain internal. |
| **Database** | Microservices show `Connection refused` | RDS security group blocks node ingress | Confirm the RDS security group allows port 3306 inbound from the cluster VPC CIDR. |
| **Helm** | `Found in Chart.yaml, but missing in charts/ directory` while planning | The umbrella chart's `file://` dependencies are not packaged (`charts/*.tgz` are git-ignored) and the Helm provider validates the chart during plan | Run `helm dependency update deploy/helm/umbrella/gl5-student`, or rely on `dependency_update = true` on `helm_release.gl5_student` which does it at plan time. |
| **Helm** | `unable to build kubernetes objects ... /api?timeout=32s: context deadline exceeded` | Transient: the EKS API server is briefly unreachable right after a large Helm install (kube-prometheus-stack) | Re-run `terraform apply` (the Jenkins pipeline retries it up to 3 times). Confirm with `kubectl get --raw /api`; no configuration change is needed. |
| **Teardown** | `terraform destroy` fails on Helm release | Cluster deleted before Helm uninstallation | Run `helm uninstall gl5-student -n gl5-student` prior to executing `terraform destroy`. |
| **Cost** | EKS control plane cost exceeds budget | Kubernetes version entered extended support | Upgrade `kubernetes_version` to an AWS standard support release. |

---

## Architecture Notes & Design Caveats

1. **Local Terraform State**:
   Terraform state is stored locally by default (`deploy/terraform/terraform.tfstate`). For team collaboration or disaster recovery, configure an S3 remote backend with DynamoDB state locking (see commented configuration in `versions.tf`).
2. **IAM & IRSA Constraints**:
   The AWS Academy Learner Lab prohibits creating custom IAM roles. All nodes, EKS components, and controllers share the pre-existing `LabRole`. IAM Roles for Service Accounts (IRSA), External Secrets Operator AWS integration, and dynamic EBS CSI volume provisioning are disabled for lab compatibility.
3. **HTTP Protocol & Security Posture**:
   The lab operates over plain HTTP with an ephemeral Keycloak database. For production, provision an ACM certificate, enable HTTPS on the ALB, switch to code flow with S256 PKCE, and bind Keycloak to a persistent RDS schema.

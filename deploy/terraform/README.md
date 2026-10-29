# Terraform — AWS EKS deployment

Terraform owns the AWS infrastructure and drives Helm for the application.
This is the end-to-end path for the **AWS Academy Learner Lab** (or any account
where the pre-created `LabRole` can be reused).

What gets created:

```text
deploy/terraform/
├── versions.tf    providers (aws, helm, kubernetes, random, null) + backend
├── variables.tf   lab-tuned defaults (t3.large, db.t3.micro, us-east-1)
├── main.tf        identity + pre-created LabRole lookup
├── vpc.tf         VPC + 2 public subnets (NO NAT gateway: budget)
├── eks.tf         EKS cluster + managed node group (lab IAM roles)
├── ecr.tf         6 ECR repos for the app images
├── rds.tf         single MySQL instance + node-security-group ingress
├── helm.tf        helm/kubernetes providers + ALB controller + app release
└── outputs.tf     kubectl config command, RDS endpoint, ECR URLs, db password
```

The umbrella chart (`deploy/helm/umbrella/gl5-student`) runs:

- the Angular frontend behind an internet-facing **ALB**;
- the API Gateway and the four Spring Boot services;
- **Keycloak** (realm re-imported on restart, ephemeral storage);
- **Amazon RDS MySQL** (one instance, four schemas) instead of the MySQL
  StatefulSets;
- **NetworkPolicies** in deny-by-default mode.

The Config Server and Eureka are **not** deployed on Kubernetes: the services
use the `kubernetes` profile, Kubernetes DNS and chart-managed Secrets.

---

## 0. Prerequisites

| Tool | Version |
|---|---|
| AWS CLI | v2, configured with the lab credentials |
| Terraform | >= 1.9 |
| Helm | >= 3.16 |
| kubectl | matching the cluster |
| Docker Desktop | with Linux containers |
| Java/Maven | only if you build the services outside Docker |

The Learner Lab credentials are temporary. In PowerShell:

```powershell
$env:AWS_ACCESS_KEY_ID     = "..."
$env:AWS_SECRET_ACCESS_KEY = "..."
$env:AWS_SESSION_TOKEN     = "..."
$env:AWS_REGION            = "us-east-1"

aws sts get-caller-identity
```

Linux (bash):

```bash
export AWS_ACCESS_KEY_ID="..."
export AWS_SECRET_ACCESS_KEY="..."
export AWS_SESSION_TOKEN="..."
export AWS_REGION="us-east-1"

aws sts get-caller-identity
```

The default region is `us-east-1`, the node type `t3.large`, the DB
`db.t3.micro`, and the Kubernetes version `1.36`. Use a version that is still
in **standard support**: extended support adds `$0.60/h` to the control plane.

```powershell
cd deploy/terraform
terraform init
```

Linux (bash):

```bash
cd deploy/terraform
terraform init
```

---

## 1. Create the ECR repositories first

The images must exist before the pods start, so create only the ECR repos
first (a few seconds).

```powershell
terraform apply -target "aws_ecr_repository.app" -auto-approve
```

Linux (bash):

```bash
terraform apply -target "aws_ecr_repository.app" -auto-approve
```

> Keep the quotes: Windows PowerShell 5.1 turns `-target=aws_ecr_repository.app`
> into `aws_ecr_repository` and Terraform rejects it with

Set up the registry variables:

```powershell
$REGION     = "us-east-1"
$ACCOUNT_ID = aws sts get-caller-identity --query Account --output text
$REGISTRY   = "$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com"

aws ecr get-login-password --region $REGION |
  docker login --username AWS --password-stdin $REGISTRY
```

Linux (bash):

```bash
REGION="us-east-1"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGISTRY="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com"

aws ecr get-login-password --region "$REGION" |
  docker login --username AWS --password-stdin "$REGISTRY"
```

---

## 2. Build and push the six application images

From the **repository root**:

```powershell
cd ../..

docker compose build `
  api-gateway student-service course-service department-service `
  enrollment-service frontend-service

foreach ($svc in "api-gateway","student-service","course-service",
                 "department-service","enrollment-service","frontend-service") {
  $image = "gl5-g4-$svc"
  docker tag "$image`:local" "$REGISTRY/$image`:latest"
  docker push "$REGISTRY/$image`:latest"
}
```

Linux (bash):

```bash
cd ../..

docker compose build \
  api-gateway student-service course-service department-service \
  enrollment-service frontend-service

for svc in api-gateway student-service course-service \
           department-service enrollment-service frontend-service; do
  image="gl5-g4-$svc"
  docker tag "$image:local" "$REGISTRY/$image:latest"
  docker push "$REGISTRY/$image:latest"
done
```

`frontend-service` is the real Angular image (it contains the `/api`, `/auth`
and `/health` Nginx configuration). Do not substitute a stock `nginx` image.


## 3. Create the AWS stack and deploy the app

```powershell
cd deploy/terraform
terraform apply -auto-approve

# Point kubectl at the new cluster (same command as the configure_kubectl output)
aws eks update-kubeconfig --name gl5-g4 --region us-east-1
```

Linux (bash):

```bash
cd deploy/terraform
terraform apply -auto-approve

# Point kubectl at the new cluster (same command as the configure_kubectl output)
aws eks update-kubeconfig --name gl5-g4 --region us-east-1
```

`update-kubeconfig` writes/updates the `gl5-g4` context in `~/.kube/config` and
makes it the current one, so the `kubectl` commands below work without any
extra flag. If you changed `cluster_name` or `aws_region`, read the exact
command from `terraform output -raw configure_kubectl`. Check it with:

```bash
kubectl config current-context   # -> arn:aws:eks:us-east-1:<account>:cluster/gl5-g4
kubectl get nodes
```

This takes about **15–25 minutes** (EKS control plane, nodes and RDS are slow).
It creates the VPC, EKS, the node group, RDS, the ALB controller and the Helm
release. The Helm release has `wait = false`, so Terraform returns before every
pod is Ready — that is normal.

Watch the pods:

```powershell
kubectl -n gl5-student get pods -w
```

Linux (bash):

```bash
kubectl -n gl5-student get pods -w
```

Expected: two `frontend` pods (1 container each), `api-gateway`, `keycloak`,
the four Spring Boot services and the four `*-db` **ExternalName** Services
(no database pods). Keycloak takes 1–2 minutes to import the realm and pass
its readiness probe.

---

## 4. Point Keycloak and the gateway at the ALB

The ALB DNS name does not exist until the Ingress is created, so this is a
second, small apply.

```powershell
$ALB = kubectl -n gl5-student get ingress frontend `
  -o jsonpath="{.status.loadBalancer.ingress[0].hostname}"

while (-not $ALB) {
  Start-Sleep -Seconds 10
  $ALB = kubectl -n gl5-student get ingress frontend `
    -o jsonpath="{.status.loadBalancer.ingress[0].hostname}"
}

terraform apply -auto-approve -var "public_hostname=$ALB"
```

Linux (bash):

```bash
ALB=$(kubectl -n gl5-student get ingress frontend \
  -o jsonpath="{.status.loadBalancer.ingress[0].hostname}")

while [ -z "$ALB" ]; do
  sleep 10
  ALB=$(kubectl -n gl5-student get ingress frontend \
    -o jsonpath="{.status.loadBalancer.ingress[0].hostname}")
done

terraform apply -auto-approve -var "public_hostname=$ALB"
```

> `public_hostname` must be passed to **every later `terraform apply`**, or it
> falls back to the empty default and reverts Keycloak and the gateway to the
> internal `http://keycloak:8080` issuer. Persist it instead, in
> `deploy/terraform/terraform.tfvars` (git-ignored):
>
> ```hcl
> public_hostname = "k8s-gl5student-1234567890-1234567890.us-east-1.elb.amazonaws.com"
> ```
>
> then a plain `terraform apply` keeps it.

This updates two things:

- **Keycloak** publishes `http://$ALB/auth` as the OIDC issuer and redirect
  base. The frontend proxies `/auth` to the in-cluster Keycloak Service.
- **The API Gateway** validates that same public issuer while fetching the
  JWKS from the internal `http://keycloak:8080` Service (the pod egress policy
  does not allow it to call the public ALB).

Wait for the two rollouts:

```powershell
kubectl -n gl5-student rollout status deployment/keycloak
kubectl -n gl5-student rollout status deployment/api-gateway
```

Linux (bash):

```bash
kubectl -n gl5-student rollout status deployment/keycloak
kubectl -n gl5-student rollout status deployment/api-gateway
```

Open the app:

```powershell
Start-Process "http://$ALB/"
```

Linux (bash):

```bash
xdg-open "http://$ALB/"   # Linux desktop
# On macOS: open "http://$ALB/"
# On a headless/remote box, just curl it:
# curl -I "http://$ALB/"
```

Demo accounts from the imported realm:

| User | Password | Role |
|---|---|---|
| `admin` | `admin` | ADMIN |
| `teacher` | `teacher` | TEACHER |
| `student` | `student` | STUDENT |

The Keycloak admin console is served through the same relay:
`http://$ALB/auth/admin/` with `admin` / `admin-admin-password` (chart value
`keycloak.adminPassword`, in the `master` realm).

> **HTTP vs HTTPS.** The lab has no routable domain, so the ALB is HTTP-only.
> Browsers do not expose Web Crypto in a non-secure context, which PKCE S256
> needs. The Angular app therefore sets `pkceMethod: false` when
> `/config.json` says so, but it still uses the **Authorization Code flow**.
> That matters: code flow returns a *refresh token*, and `keycloak-js` renews
> the 5-minute access token with it silently (the HTTP interceptor calls
> `updateToken()` on every API request). Implicit flow returns no refresh
> token, so `updateToken()` rejected immediately with
> `Unable to update token, no refresh token available.`, and the shell opened
> the "Session administrative expirée" dialog as soon as the dashboard loaded.
> The Gateway API client (`directAccessGrantsEnabled`) is only used for the
> `password` grant in smoke tests and is unrelated to the browser flow.
>
> For production, put the ALB behind HTTPS (ACM certificate + a real domain,
> optionally CloudFront), set `runtime.pkceMethod = S256` in `/config.json`
> and re-enable the client's `pkce.code.challenge.method` attribute: code flow
> **with** PKCE is the safest combination.
>
> The same restriction bites `keycloak-js` 26 even without PKCE: it builds the
> OAuth `state` with `crypto.randomUUID()`, which is also secure-context-only,
> and throws `Web Crypto API is not available.` **before** it ever contacts
> Keycloak. The login page then reports
> "Aucune réponse de Keycloak (/auth)" even though `/auth` answers `200` from
> the cluster — a misleading message, since nothing network-related failed.
> `frontend-service/src/app/core/auth/insecure-context-crypto.ts` shims
> `randomUUID` from `crypto.getRandomValues` (available over plain HTTP) and is
> imported first in `main.ts`. Delete it once the app is served over HTTPS.

---

## 5. Verify

```powershell
kubectl -n gl5-student get pods,svc,ingress
kubectl -n gl5-student get events --sort-by=.lastTimestamp
```

Linux (bash):

```bash
kubectl -n gl5-student get pods,svc,ingress
kubectl -n gl5-student get events --sort-by=.lastTimestamp
```

Through the frontend (same origin, the Nginx `/api` relay):

```powershell
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

# Each backend keeps its own context path, and the gateway forwards
# /<context-path>/** unchanged, so the URLs below mirror the Angular API layer.
foreach ($path in @(
  "/api/department/api/departments",
  "/api/course/api/courses",
  "/api/student/students/getAllStudents",
  "/api/enrollment/Enrollment/getAllEnrollment"
)) {
  $r = Invoke-WebRequest -Uri "http://$ALB$path" `
    -Headers @{ Authorization = "Bearer $TOKEN" } -UseBasicParsing
  "$path -> $($r.StatusCode)"
}
```

Linux (bash, needs `curl` and `jq`):

```bash
TOKEN=$(curl -s -X POST \
  "http://$ALB/auth/realms/gl5/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "grant_type=password" \
  --data-urlencode "client_id=api-gateway" \
  --data-urlencode "username=admin" \
  --data-urlencode "password=admin" |
  jq -r .access_token)

# No jq? Replace the jq call with:
#   python3 -c 'import json,sys; print(json.load(sys.stdin)["access_token"])'

# Each backend keeps its own context path, and the gateway forwards
# /<context-path>/** unchanged, so the URLs below mirror the Angular API layer.
for path in \
  "/api/department/api/departments" \
  "/api/course/api/courses" \
  "/api/student/students/getAllStudents" \
  "/api/enrollment/Enrollment/getAllEnrollment"; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://$ALB$path" \
    -H "Authorization: Bearer $TOKEN")
  echo "$path -> $code"
done
```

Fresh databases are empty, so the four calls above return empty collections —
`200` is the success criterion, not the payload.

The Swagger UI is at `http://$ALB/api/swagger-ui.html` (through the same
relay; it is public per the gateway configuration). The aggregated specs are
served at `/api/department/v3/api-docs`, `/api/course/v3/api-docs`, etc.

> **Transient 503s right after a rollout.** Each route sits behind a
> Resilience4j circuit breaker. Calls made while a backend pod is still
> rolling (or while the gateway is warming up) are recorded as failures; once
> the breaker opens it serves its fallback for
> `wait-duration-in-open-state=10s`, then half-opens and closes again on the
> first successful probe. A lone `503` immediately after `terraform apply` is
> therefore expected — re-run the call after ~10 seconds instead of
> redeploying. The breaker state is visible in the gateway health endpoint and
> in `kubectl -n gl5-student logs deploy/api-gateway | Select-String "Circuit breaker"`
> (Linux: `... | grep "Circuit breaker"`).
> Because the dashboard fires all four registry calls in parallel, a rollout can
> make them fail together: the page still renders, and the **Actualiser**
> button reloads the data once the breakers are closed.

---

## 6. Update an image

```powershell
# build again, then
$TAG = (git rev-parse --short HEAD)
foreach ($svc in "api-gateway","student-service","course-service",
                 "department-service","enrollment-service","frontend-service") {
  $image = "gl5-g4-$svc"
  docker tag "$image`:local" "$REGISTRY/$image`:$TAG"
  docker push "$REGISTRY/$image`:$TAG"
}

terraform apply -auto-approve -var "image_tag=$TAG" -var "public_hostname=$ALB"
```

Linux (bash):

```bash
# build again, then
TAG=$(git rev-parse --short HEAD)
for svc in api-gateway student-service course-service \
           department-service enrollment-service frontend-service; do
  image="gl5-g4-$svc"
  docker tag "$image:local" "$REGISTRY/$image:$TAG"
  docker push "$REGISTRY/$image:$TAG"
done

terraform apply -auto-approve -var "image_tag=$TAG" -var "public_hostname=$ALB"
```

Helm rolls the Deployments because the image tag in the pod template changed.
Reusing `latest` with `pullPolicy: IfNotPresent` does **not** force a pull;
either use a unique tag or add `kubectl rollout restart` after pushing.

### Updating Keycloak

Keycloak follows its own version, not `image_tag`. To bump it, mirror the new
upstream tag and apply it:

```powershell
$KC_TAG = "26.8.1"
docker pull "quay.io/keycloak/keycloak:$KC_TAG"
docker tag  "quay.io/keycloak/keycloak:$KC_TAG" "$REGISTRY/gl5-g4-keycloak:$KC_TAG"
docker push "$REGISTRY/gl5-g4-keycloak:$KC_TAG"

terraform apply -auto-approve -var "keycloak_image_tag=$KC_TAG" -var "public_hostname=$ALB"
```

Linux (bash):

```bash
KC_TAG="26.8.1"
docker pull "quay.io/keycloak/keycloak:$KC_TAG"
docker tag  "quay.io/keycloak/keycloak:$KC_TAG" "$REGISTRY/gl5-g4-keycloak:$KC_TAG"
docker push "$REGISTRY/gl5-g4-keycloak:$KC_TAG"

terraform apply -auto-approve -var "keycloak_image_tag=$KC_TAG" -var "public_hostname=$ALB"
```

The pod template tag changes, so the Deployment rolls by itself. Check the
upstream release notes first: the chart only supports the `KC_HOSTNAME` +
`KC_PROXY_HEADERS` options of Keycloak 26.

---

## 7. Teardown (important for the budget)

```powershell
# Delete the application first so Helm removes its resources cleanly.
helm uninstall gl5-student -n gl5-student
terraform destroy -auto-approve
```

Linux (bash):

```bash
# Delete the application first so Helm removes its resources cleanly.
helm uninstall gl5-student -n gl5-student
terraform destroy -auto-approve
```

Check the AWS console for leftovers: EKS, RDS, the ALB, the two node EBS
volumes, and the ECR repositories (`force_delete = true` is set).

> **`terraform destroy` may stop at the VPC.** The AWS Load Balancer
> Controller creates two security groups (`k8s-traffic-*` and
> `k8s-<stack>-*`) that are **not** in Terraform state, so they survive
> `helm uninstall` and make `DeleteVpc` fail with `DependencyViolation`. The
> state then keeps one resource, `aws_vpc.gl5` — everything billable (EKS,
> node group, RDS, ALB, ECR, subnets, IGW, route tables) is already gone.
> Either leave it (a VPC is free and the next `apply` reuses it), or finish
> the job for a truly empty state:
>
> ```powershell
> $VPC = terraform state show -no-color aws_vpc.gl5 | Select-String 'id\s+=' |
>   ForEach-Object { ($_.Line -split '=')[1].Trim().Trim('"') }
> aws ec2 describe-security-groups --filters "Name=vpc-id,Values=$VPC" `
>   --query "SecurityGroups[?GroupName!='default'].GroupId" --output text |
>   ForEach-Object { $_ -split '\s+' } |
>   ForEach-Object { aws ec2 delete-security-group --group-id $_ }
> aws ec2 delete-vpc --vpc-id $VPC
> terraform state rm aws_vpc.gl5
> ```
>
> Linux (bash):
>
> ```bash
> VPC=$(terraform state show -no-color aws_vpc.gl5 |
>   grep -E '^[[:space:]]*id[[:space:]]*=' | head -n1 | cut -d'"' -f2)
> aws ec2 describe-security-groups --filters "Name=vpc-id,Values=$VPC" \
>   --query "SecurityGroups[?GroupName!='default'].GroupId" --output text |
>   tr '\t' '\n' | grep -v '^None$' |
>   xargs -r -n1 aws ec2 delete-security-group --group-id
> aws ec2 delete-vpc --vpc-id "$VPC"
> terraform state rm aws_vpc.gl5
> ```
>
> If the lab session ends or is cancelled mid-destroy, every AWS call starts
> failing with `... explicit deny in an identity-based policy:
> arn:aws:iam::<account>:policy/voc-cancel-cred`. That is not a Terraform
> fault: the temporary credentials still pass `sts:GetCallerIdentity`, but the
> lab has revoked every other permission. Start/resume the lab and copy fresh
> credentials before continuing.

Approximate running cost while everything is up: **$0.35–0.45/h**
(EKS control plane + 2× t3.large + ALB + RDS + EBS + ECR), i.e. roughly
**$8–11/day**. The stack deliberately has **no NAT gateway** (which alone would
add ~$32/month).

---

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| `ImagePullBackOff` / `ErrImagePull` | Image not pushed, wrong tag, or the node role cannot read ECR. Check `kubectl -n gl5-student describe pod <pod>`; the lab `LabRole` normally has ECR read access. |
| Pods `Pending` | Not enough CPU/memory on two `t3.large` nodes. Check `kubectl describe node`; reduce replicas or raise `node_instance_type`. |
| ALB never appears | `kubectl -n kube-system logs deploy/aws-load-balancer-controller`. The public subnets must keep the `kubernetes.io/role/elb=1` tag; the controller uses the node role in this lab. |
| App loads but login redirects to `keycloak:8080` | Step 4 was not applied. Run `terraform apply -var="public_hostname=$ALB"` and wait for the Keycloak rollout. |
| Keycloak `CrashLoopBackOff` with `Unrecognized option` | A removed Keycloak 25 option was reintroduced in the chart. Keycloak 26 only knows `KC_HOSTNAME` + `KC_PROXY_HEADERS`; `hostname-strict`, `hostname-path` and `proxy` no longer exist. |
| `/auth` returns `502 Bad Gateway` | Keycloak is still importing the realm or is not Ready. `kubectl -n gl5-student logs deploy/keycloak` and `get pods`. |
| Login POST returns `502` while `/auth/...` GETs work | Different cause: the frontend's nginx relay. Keycloak 26's login POST answers with several large `Set-Cookie` headers (`KC_RESTART` holds the whole authentication session) and nginx's 4 kB default header buffer overflows: `upstream sent too big header while reading response header from upstream`. `frontend-service/docker/nginx.conf` already sets `proxy_buffer_size 16k` / `proxy_buffers 8 16k` / `proxy_busy_buffers_size 32k` on `location ^~ /auth/`. If you shrink or rewrite that block, keep those directives. |
| Login redirects in a loop after a redeploy | The ALB DNS name changed and the old `public_hostname` is still in use (or was omitted). Re-read the Ingress hostname and apply it again. |
| "Session administrative expirée" dialog opens right after login | The browser flow has no refresh token. That happens with the implicit flow, which `keycloak-js` cannot refresh: `updateToken()` throws `Unable to update token, no refresh token available.` on every API request and the shell shows the dialog. The app must use `flow: 'standard'` (Authorization Code) with `pkceMethod: false` over HTTP — code flow returns a refresh token and renews the 5-minute access token silently. `cursus-frontend` keeps `standardFlowEnabled: true` and `implicitFlowEnabled: false`. |
| Editing `realm.json.tpl` seems to do nothing | Keycloak only imports the realm when it does not exist yet, and the realm DB is in-memory. Template changes therefore take effect on the next Keycloak pod creation (realm re-imported, all sessions dropped), not on `terraform plan`. |
| `401` on `/api/**` | Issuer mismatch. Compare the token `iss` with `KEYCLOAK_ISSUER_URI` on the gateway. `JWK_SET_URI` must stay on the internal Service. |
| Login works but API calls fail with CORS | The Angular app must call `/api` on the same origin (chart default); do not point it at the ALB/API port directly. |
| Services restart with `Connection refused` to RDS | Check the RDS security group and that the RDS endpoint is in the VPC CIDR allowed by `databaseCidrBlocks`. |
| `terraform destroy` fails on Helm | Run `helm uninstall gl5-student -n gl5-student` first (the release must be reachable before the cluster is destroyed). |
| EKS control plane costs more than expected | The cluster drifted to extended support. Upgrade `kubernetes_version` before the standard-support end date. |

## Notes

- Terraform state is **local** (`deploy/terraform/terraform.tfstate`). Back it up
  or switch to the S3 backend commented in `versions.tf`; losing it orphans
  billable resources.
- The lab IAM role has no IRSA. Consequently External Secrets, the EBS CSI
  driver and the RDS-managed Keycloak database are not used. They are the next
  steps on a real AWS account.
- The app uses plain HTTP and an ephemeral Keycloak database (the realm is
  re-imported on each Keycloak pod rollout). This keeps the demo reproducible
  and cheap, not production-grade.

# ---------------------------------------------------------------------------
# Learner Lab inputs. Every default is chosen for the lab constraints:
#   - t3.large is the largest EKS-compatible size ("large" class)
#   - db.t3.micro keeps the budget low (labs: nano..medium allowed)
#   - 2 nodes max (9 concurrently running EC2 instances per region, and every
#     other service in the account counts toward it)
# ---------------------------------------------------------------------------

variable "aws_region" {
  description = "Region. The Learner Lab only allows us-east-1 or us-west-2."
  type        = string
  default     = "us-east-1"
}

variable "cluster_name" {
  description = "EKS cluster name"
  type        = string
  default     = "gl5-g4"
}

variable "eci_azs" {
  description = "Availability zones (EKS needs at least 2 subnets)"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1c"]
}

variable "vpc_cidr" {
  description = "VPC CIDR for the cluster"
  type        = string
  default     = "10.0.0.0/16"
}

variable "node_instance_type" {
  description = "Node size. Lab max: largest allowed class is 'large'."
  type        = string
  default     = "t3.large"
}

variable "node_count" {
  description = "Managed node group size"
  type        = number
  default     = 2
}

variable "node_disk_size" {
  description = "Node EBS root volume size (GB, gp3)"
  type        = number
  default     = 50
}

variable "storage_class" {
  description = "Default StorageClass used by PVCs on the cluster"
  type        = string
  default     = "gp2"
}

variable "db_instance_class" {
  description = "RDS size (labs: nano/small/medium allowed)"
  type        = string
  default     = "db.t3.micro"
}

variable "db_username" {
  description = "RDS master username. All four Spring services connect to it."
  type        = string
  default     = "gl5admin"
}

# ---------------------------------------------------------------------------
# Pre-created IAM roles of the Learner Lab. Terraform cannot create roles in
# the lab (IAM is read-only except service-linked roles), so we reference
# them by name.
# ---------------------------------------------------------------------------
variable "cluster_role_name" {
  description = "IAM role for the EKS control plane (override if your lab provides a dedicated role)"
  type        = string
  default     = "LabRole"
}

variable "node_role_name" {
  description = "IAM role for the EKS worker nodes (and the ALB controller)"
  type        = string
  default     = "LabRole"
}

variable "image_tag" {
  description = "Tag of the app images pushed to ECR"
  type        = string
  default     = "latest"
}

variable "kubernetes_version" {
  description = "EKS Kubernetes version. Keep it on a version still in standard support: extended support adds $0.60/h to the control plane."
  type        = string
  default     = "1.36"
}

# ---------------------------------------------------------------------------
# Public entry point.
#
# The ALB hostname only exists after the frontend Ingress has been created by
# Helm, so this value cannot be known on the first apply. Leave it empty for
# the first `terraform apply`, read the ALB hostname, then apply again:
#
#   terraform apply -var="public_hostname=<alb-dns-name>"
#
# Keycloak publishes this URL as the OIDC issuer and the API Gateway validates
# the same issuer. Without it, login redirects point at the in-cluster
# `keycloak:8080` Service, which a browser cannot resolve.
# ---------------------------------------------------------------------------
variable "public_hostname" {
  description = "Public hostname (usually the ALB DNS name) that serves the frontend. Empty during the first apply."
  type        = string
  default     = ""
}

variable "public_scheme" {
  description = "http for the ALB DNS name (no ACM certificate); https when public_hostname is a real domain behind an HTTPS listener."
  type        = string
  default     = "http"

  validation {
    condition     = contains(["http", "https"], var.public_scheme)
    error_message = "public_scheme must be http or https."
  }
}

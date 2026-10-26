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

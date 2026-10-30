# ---------------------------------------------------------------------------
# Providers for the Learner Lab EKS stack.
#
# Terraform owns the AWS infrastructure (VPC, EKS, node group, RDS, ECR).
# Helm owns the application (deploy/helm/umbrella/gl5-student). The two are
# joined by the helm/kubernetes providers, which authenticate to the EKS API
# server with `aws eks get-token` after aws_eks_cluster creates it.
#
# Learner Lab constraints baked into this scaffold:
#   - us-east-1 only
#   - no IAM roles can be created: use the pre-created LabRole (or override
#     cluster_role_name when a dedicated control-plane role is available)
#   - no NAT gateway (budget): public subnets only, internet-facing ALB
# ---------------------------------------------------------------------------

terraform {
  required_version = ">= 1.9"

  # State is local by default. If you want it to survive lab resets, switch to
  # an S3 backend (do NOT use DynamoDB locking: keep it simple, native S3
  # locking works with TF >= 1.9):
  #   backend "s3" {
  #     bucket       = "gl5-terraform-state-<account-id>"
  #     key          = "eks/gl5.tfstate"
  #     region       = "us-east-1"
  #   }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 3.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.30"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project   = "gl5-g4"
      ManagedBy = "terraform"
    }
  }
}

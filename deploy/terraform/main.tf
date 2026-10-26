# ---------------------------------------------------------------------------
# Identity + pre-created lab IAM roles data sources. Reference them by name
# instead of trying to create (the lab forbids creating roles).
# ---------------------------------------------------------------------------

data "aws_caller_identity" "current" {}

data "aws_iam_role" "cluster_role" {
  name = var.cluster_role_name
}

data "aws_iam_role" "node_role" {
  name = var.node_role_name
}

locals {
  account_id = data.aws_caller_identity.current.account_id
  ecr_domain = "${local.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com"
}

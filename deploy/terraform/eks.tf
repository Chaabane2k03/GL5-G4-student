# ---------------------------------------------------------------------------
# EKS cluster + managed node group using the pre-created lab roles.
# No OIDC provider / no IRSA: RDS and ALB controller run with the node's
# LabRole permissions (fine for a lab, tighten on a real account).
# ---------------------------------------------------------------------------

resource "aws_eks_cluster" "gl5" {
  name     = var.cluster_name
  role_arn = data.aws_iam_role.cluster_role.arn
  version  = var.kubernetes_version

  vpc_config {
    subnet_ids              = aws_subnet.nodes[*].id
    endpoint_public_access  = true
    endpoint_private_access = true
  }

  # Wait for network side to be ready to avoid a half-created control plane
  depends_on = [aws_route_table_association.public]

}

resource "aws_eks_node_group" "app" {
  cluster_name    = aws_eks_cluster.gl5.name
  node_group_name = "app"
  node_role_arn   = data.aws_iam_role.node_role.arn
  subnet_ids      = aws_subnet.nodes[*].id

  capacity_type  = "ON_DEMAND"
  instance_types = [var.node_instance_type]
  disk_size      = var.node_disk_size

  scaling_config {
    desired_size = var.node_count
    min_size     = var.node_count
    max_size     = var.node_count
  }

  labels = {
    workload = "app"
  }

  update_config {
    max_unavailable = 1
  }

  depends_on = [aws_eks_cluster.gl5]
}

output "cluster_name" {
  description = "EKS cluster name"
  value       = aws_eks_cluster.gl5.name
}

output "cluster_endpoint" {
  description = "EKS API server endpoint"
  value       = aws_eks_cluster.gl5.endpoint
}

output "configure_kubectl" {
  description = "Command to point kubectl at the cluster"
  value       = "aws eks update-kubeconfig --name ${aws_eks_cluster.gl5.name} --region ${var.aws_region}"
}

output "rds_endpoint" {
  description = "RDS MySQL endpoint"
  value       = aws_db_instance.gl5.address
}

output "db_username" {
  value = var.db_username
}

output "db_password" {
  value     = random_password.db_master.result # sensitive
  sensitive = true
}

output "ecr_urls" {
  description = "ECR repo URLs — tag & push images here"
  value = tomap({
    for name, repo in aws_ecr_repository.app : name => repo.repository_url
  })
}

output "helm_command" {
  description = "Alternative deployment path: plain Helm instead of helm_release"
  value       = <<-EOT
    helm upgrade --install gl5-student ../helm/umbrella/gl5-student \
      -n gl5-student --create-namespace \
      --set rds.enabled=true --set rds.databases[0].name=student-db \
      --set rds.databases[0].endpoint=${aws_db_instance.gl5.address} \
      --wait --timeout 15m
  EOT
}

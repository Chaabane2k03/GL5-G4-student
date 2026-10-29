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

output "alb_hostname_command" {
  description = "Read the ALB DNS name after the Ingress is reconciled"
  value       = "kubectl -n gl5-student get ingress frontend -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'"
}

output "phase2_command" {
  description = "Run this once the ALB hostname is known: it switches Keycloak and the gateway to the public issuer"
  value       = "terraform apply -var=\"public_hostname=<alb-dns-name>\""
}

output "app_url" {
  description = "Public URL once public_hostname is set"
  value       = var.public_hostname == "" ? "(not set yet — see phase2_command)" : "${var.public_scheme}://${var.public_hostname}/"
}

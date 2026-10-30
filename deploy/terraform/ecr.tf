# ---------------------------------------------------------------------------
# Amazon ECR repositories for the app images. Push them after ECR is created:
#   aws ecr get-login-password --region us-east-1 | docker login \
#       --username AWS --password-stdin <account>.dkr.ecr.us-east-1.amazonaws.com
#   docker tag gl5-g4-api-gateway:local <account>.../gl5-g4-api-gateway:latest
#   docker push ...
# ---------------------------------------------------------------------------

resource "aws_ecr_repository" "app" {
  # One repository per locally built image. Keycloak is pulled from quay.io
  # directly by the chart, so it does not need an ECR mirror in the lab.
  for_each = toset([
    "gl5-g4-api-gateway",
    "gl5-g4-student-service",
    "gl5-g4-course-service",
    "gl5-g4-department-service",
    "gl5-g4-enrollment-service",
    "gl5-g4-frontend-service",
  ])

  name                 = each.key
  force_delete         = true
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }


}

resource "aws_ecr_lifecycle_policy" "app" {
  for_each   = aws_ecr_repository.app
  repository = each.value.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep only the last 10 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 10
      }
      action = { type = "expire" }
    }]
  })
}

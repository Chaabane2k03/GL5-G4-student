# ---------------------------------------------------------------------------
# Amazon ECR repositories for the app images. Push them after ECR is created:
#   aws ecr get-login-password --region us-east-1 | docker login \
#       --username AWS --password-stdin <account>.dkr.ecr.us-east-1.amazonaws.com
#   docker tag gl5-g4-api-gateway:local <account>.../gl5-g4-api-gateway:latest
#   docker push ...
# ---------------------------------------------------------------------------

resource "aws_ecr_repository" "app" {
  # NOTE: individual repos; adjust names to the umbrella image keys
  for_each = toset([
    "gl5-g4-api-gateway",
    "gl5-g4-student-service",
    "gl5-g4-course-service",
    "gl5-g4-department-service",
    "gl5-g4-enrollment-service",
    "gl5-g4-keycloak",
    "gl5-g4-frontend",
  ])

  name                 = each.key
  force_delete         = true
  image_tag_mutability = "MUTABLE"

  tags = {
    Project = "gl5-g4"
  }
}

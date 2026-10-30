# ---------------------------------------------------------------------------
# VPC without a NAT gateway. Learner Lab budget killer is the NAT gateway
# (~$32/month running 24/7), so the worker nodes sit in public subnets and
# speak to ECR/EC2 APIs directly. The ALB is internet-facing.
# ---------------------------------------------------------------------------

resource "aws_vpc" "gl5" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = "gl5-vpc"
  }
}

resource "aws_internet_gateway" "gl5" {
  vpc_id = aws_vpc.gl5.id

  tags = {
    Name = "gl5-igw"
  }
}

resource "aws_subnet" "nodes" {
  count                   = length(var.eci_azs)
  vpc_id                  = aws_vpc.gl5.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 8, count.index)
  availability_zone       = var.eci_azs[count.index]
  map_public_ip_on_launch = true

  # Required by AWS Load Balancer Controller discovery
  tags = {
    Name                                        = "gl5-node-${count.index}"
    "kubernetes.io/role/elb"                    = "1"
    "kubernetes.io/role/ingress"                = "1"
    "kubernetes.io/cluster/${var.cluster_name}" = "shared"
  }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.gl5.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.gl5.id
  }

  tags = {
    Name = "gl5-public"
  }
}

resource "aws_route_table_association" "public" {
  count          = length(aws_subnet.nodes)
  subnet_id      = aws_subnet.nodes[count.index].id
  route_table_id = aws_route_table.public.id
}

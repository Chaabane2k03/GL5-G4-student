# ---------------------------------------------------------------------------
# Amazon RDS: one MySQL instance hosting all four schemas. The Spring
# services point at the same host with different schema names (studentdb,
# course_db, departmentdb, enrollmentdb) — see helm.tf. All four services
# authenticate with the master user (simplest lab path: no CREATE USER SQL).
#
# Lab constraints: t3.micro, single AZ, 20GB gp2, enhanced monitoring off.
# ---------------------------------------------------------------------------

resource "random_password" "db_master" {
  length           = 32
  special          = false
  override_special = ""
}

resource "aws_db_subnet_group" "gl5" {
  name       = "gl5-rds-subnets"
  subnet_ids = aws_subnet.nodes[*].id
}

resource "aws_security_group" "rds" {
  name_prefix = "gl5-rds-"
  vpc_id      = aws_vpc.gl5.id

  tags = {
    Name = "gl5-rds-sg"
  }
}

resource "aws_vpc_security_group_ingress_rule" "mysql_from_nodes" {
  security_group_id            = aws_security_group.rds.id
  referenced_security_group_id = aws_eks_cluster.gl5.vpc_config[0].cluster_security_group_id
  from_port                    = 3306
  to_port                      = 3306
  ip_protocol                  = "tcp"
}

resource "aws_db_instance" "gl5" {
  identifier            = "gl5-g4-db"
  engine                = "mysql"
  instance_class        = var.db_instance_class
  allocated_storage     = 20
  max_allocated_storage = 50
  storage_type          = "gp2"
  multi_az              = false
  storage_encrypted     = true

  db_subnet_group_name   = aws_db_subnet_group.gl5.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false

  username = var.db_username
  password = random_password.db_master.result

  backup_retention_period    = 7
  skip_final_snapshot        = true
  deletion_protection        = false
  auto_minor_version_upgrade = true

  apply_immediately = true
}

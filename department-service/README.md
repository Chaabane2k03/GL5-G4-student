# Department Service

Standalone Spring Boot microservice for department data. The service has no JPA relationships to student, course, or enrollment entities; it owns only its department table.

## Requirements

- Java 17 or newer
- Docker, for the MySQL Testcontainers integration test
- MySQL 8.0+ for running the service outside tests

## Run locally

Start MySQL on port `3306` and create a database named `departmentdb`, then run from the repository root:

```bash
bash ./mvnw -f department-service/pom.xml spring-boot:run
```

The service listens on `http://localhost:8082`. The default local database settings use MySQL user `root` with an empty password. Override them with:

```bash
DB_URL='jdbc:mysql://localhost:3306/departmentdb' \
DB_USERNAME='root' \
DB_PASSWORD='your-password' \
bash ./mvnw -f department-service/pom.xml spring-boot:run
```

`SERVER_PORT`, `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, and `DDL_AUTO` can be set to configure the service. `DDL_AUTO` defaults to `update`; use an explicit migration strategy for production deployments.

## REST API

Base path: `/api/departments`

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/departments` | List departments |
| `GET` | `/api/departments/{id}` | Get a department |
| `POST` | `/api/departments` | Create a department |
| `PUT` | `/api/departments/{id}` | Update a department |
| `DELETE` | `/api/departments/{id}` | Delete a department |

The department JSON fields are `idDepartment`, `name`, `location`, `phone`, and `head`. A missing department returns HTTP `404`.

## Swagger / OpenAPI

When the service is running:

- Swagger UI: `http://localhost:8082/swagger-ui.html`
- OpenAPI JSON: `http://localhost:8082/v3/api-docs`

## Tests and quality

Run the unit and MySQL Testcontainers integration tests, package the application, and generate JaCoCo coverage:

```bash
bash ./mvnw -f department-service/pom.xml clean verify
```

Docker must be running for the integration test. The repository-root `Jenkinsfile` runs this build and test command, submits analysis to the Jenkins SonarQube installation named `SonarQube`, and fails the pipeline if the quality gate fails. Configure the SonarQube server and webhook in Jenkins before running the pipeline.

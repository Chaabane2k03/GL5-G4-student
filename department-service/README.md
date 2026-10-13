# Department Service

Standalone Spring Boot microservice for department data. The service has no JPA relationships to student, course, or enrollment entities; it owns only its department table.

## Requirements

- Java 17 or newer
- Docker and Docker Compose, for the MySQL deployment containers
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

Run the unit tests and HTTP integration tests against the H2 in-memory database, package the application, and generate JaCoCo coverage:

```bash
bash ./mvnw -f department-service/pom.xml clean verify
```

The tests do not need Docker or MySQL. [Jenkinsfile](./Jenkinsfile) runs them in a Maven container, then builds and runs the service with MySQL using Docker Compose. It submits analysis to the Jenkins SonarQube installation named `SonarQube` and fails the pipeline if the quality gate fails.

## Docker image

Build and run the application and MySQL containers together:

```bash
docker compose -f department-service/compose.yaml up --build
```

This starts MySQL on port `3306` and the department API on port `8082`. The service connects to the `mysql` Compose hostname; no host network alias is needed. Defaults are for local development only. For a non-default database password, set `MYSQL_PASSWORD` and `MYSQL_ROOT_PASSWORD` in the environment before starting Compose.

```bash
docker compose -f department-service/compose.yaml down
```

The Jenkins pipeline first runs tests with H2, then builds the production image and verifies the running API against the separate MySQL container.

## Jenkins configuration

Configure Jenkins with:

1. **Plugins:** Pipeline, Git, SonarQube Scanner for Jenkins, Email Extension, and JUnit.
2. **Agent:** a Linux agent with Docker CLI and Docker Compose access, permission to use `/var/run/docker.sock`, and `curl`. Docker commands must work for the Jenkins agent user (`docker info`). The H2 test stage does not require Docker; the following Compose stage starts the MySQL and department-service containers.
3. **Multibranch Pipeline:** point the script path to `department-service/Jenkinsfile`. The current stages run for branch `feature/department-service`; update the `when { branch ... }` conditions if the service branch name changes.
4. **SonarQube:** in **Manage Jenkins → System → SonarQube servers**, add a server named exactly `SonarQube`, set its URL, and select a Jenkins credential containing a SonarQube user token. In SonarQube, configure a project with key `gl5-g4-department-service`, and configure its webhook to `https://<jenkins-url>/sonarqube-webhook/` for the quality-gate wait step.
5. **Email:** install/configure SMTP under **Manage Jenkins → System → Extended E-mail Notification**. Set `EMAIL_RECIPIENTS` as a global environment variable or a job environment value to the notification recipient list. If it is unset, the build succeeds without sending an email.

The pipeline builds the image as `gl5-g4-department-service:<BUILD_NUMBER>`; publishing it to a registry is not configured.

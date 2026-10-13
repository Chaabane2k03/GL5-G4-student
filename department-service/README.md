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

The tests do not need Docker or MySQL. [Jenkinsfile](./Jenkinsfile) runs them directly in the Jenkins workspace using the configured `JDK17` and `Maven3` tools, then builds and runs the service with MySQL using Docker Compose. It submits analysis to the Jenkins SonarQube installation named `SonarQube` and fails the pipeline if the quality gate fails.

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
2. **Built-in node Docker access:** the Docker-enabled controller image is defined in [`jenkins/Dockerfile`](../jenkins/Dockerfile), and its persistent runtime settings are in [`jenkins/compose.yaml`](../jenkins/compose.yaml). From the repository root, set the host socket group ID, preserve the current controller as a rollback option, and start the replacement:

   ```bash
   export DOCKER_GID=$(stat -c '%g' /var/run/docker.sock)
   docker stop jenkins-igl5
   docker rename jenkins-igl5 jenkins-igl5-before-docker
   DOCKER_GID="$DOCKER_GID" docker compose -f jenkins/compose.yaml up -d --build
   ```

   The Compose file reuses the existing external `jenkins_home` volume, publishes ports `8080` and `50000`, mounts the host Docker socket, joins the existing `gl5-shared` and `sonarqube-igl5_default` networks, maps `host.docker.internal` to the Docker host, and sets `unless-stopped` restart behavior. Verify the Jenkins UI and `docker info`/`docker compose version` inside `jenkins-igl5` before deleting the stopped backup container with `docker rm jenkins-igl5-before-docker` (do not use `-v`). The pipeline uses `agent any` and checks Docker access before continuing.
3. **Docker permission warning:** access to the Docker socket grants effective root-level control of the Docker host. Only give it to a Jenkins controller and jobs you trust.
4. **Jenkins tools:** under **Manage Jenkins → Tools**, configure a JDK installation named exactly `JDK17` (Java 17) and a Maven installation named exactly `Maven3` (Maven 3.9+).
5. **Multibranch Pipeline:** point the script path to `department-service/Jenkinsfile`. The current stages run for branch `feature/department-service`; update the `when { branch ... }` conditions if the service branch name changes.
6. **SonarQube:** in **Manage Jenkins → System → SonarQube servers**, add a server named exactly `SonarQube`, set its URL, and select a Jenkins credential containing a SonarQube user token. In SonarQube, configure a project with key `gl5-g4-department-service`, and configure its webhook to `https://<jenkins-url>/sonarqube-webhook/` for the quality-gate wait step.
7. **Email:** install/configure SMTP under **Manage Jenkins → System → Extended E-mail Notification**. Set `EMAIL_RECIPIENTS` as a global environment variable or a job environment value to the notification recipient list. If it is unset, the build succeeds without sending an email.

The pipeline builds the image as `gl5-g4-department-service:<BUILD_NUMBER>`; publishing it to a registry is not configured.

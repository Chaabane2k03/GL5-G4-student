# Course Service

Standalone REST microservice to manage courses (create, read, update, archive, activate),
built with **Spring Boot 3.5.16** on **Java 17** and **Maven**.

The service owns its own MySQL database and references departments **by id only** — it holds
no foreign keys or joins to other services, so it can be deployed and evolved independently.

---

## 1. Tech stack

| Concern            | Choice                                              |
|--------------------|-----------------------------------------------------|
| Language / runtime | Java 17                                             |
| Framework          | Spring Boot 3.5.16 (Web, Data JPA, Validation)      |
| Database           | MySQL 8.0 (schema managed by `schema.sql`)          |
| Configuration      | Config Server (`develop`) or environment variables   |
| Inter-service      | OpenFeign → department-service (by id only)          |
| API docs           | springdoc-openapi 2.9.1 (Swagger UI)                |
| Testing            | JUnit 5, Mockito, MockMvc, Testcontainers           |
| Coverage           | JaCoCo (LINE ≥ 90 %, BRANCH ≥ 80 %)                  |
| Quality            | SonarQube                                            |
| Packaging          | Multi-stage Docker image (non-root) + Docker Compose |
| CI                 | Jenkins (`Jenkinsfile`)                             |

---

## 2. Prerequisites

- JDK 17+
- Maven 3.9+
- Docker (with Compose v2) — **it must be running**, because the tests use Testcontainers
  (they start a real MySQL) and the Docker workflow needs the daemon.

---

## 3. Configuration

The service runs in one of two modes.

**Platform (default on `develop`)** — configuration comes from the **Config Server**. `application.yml`
only sets `server.port` and `spring.config.import: optional:configserver:...`; the datasource, JPA
settings, `server.servlet.context-path` (`/course`) and the Eureka registration are served by the
Config Server. Using this mode therefore needs `SPRING_PROFILES_ACTIVE=docker` and `CONFIG_SERVER_URL`
(plus `EUREKA_URL`) — which is exactly what the repository root's `docker-compose.yml` provides.

**Standalone** — no Config Server and no Eureka. `docker-compose.yml` in this directory switches both
clients off and injects the datasource and `schema.sql` directly, so the service starts on its own
with nothing but MySQL.

Environment variables always take precedence (OS env → Config Server → bundled `application.yml`),
so every value in the table below can still be overridden per environment.

| Group             | Variables                                                                                                     | Defaults |
|-------------------|---------------------------------------------------------------------------------------------------------------|----------|
| Database (app)    | `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_JDBC_PARAMS`                                     | `localhost`, `3308`, `course_db`, `course_user`, `course_pass`, `useSSL=false&…` |
| Application       | `SERVER_PORT`, `SPRING_APP_NAME`, `JPA_DDL_AUTO`, `JPA_OPEN_IN_VIEW`, `SQL_INIT_MODE`, `SQL_SCHEMA_LOCATIONS`, `LOG_LEVEL_ROOT`, `MANAGEMENT_ENDPOINTS`, `MANAGEMENT_HEALTH_PROBES`, `HIBERNATE_JDBC_TIME_ZONE`, `APP_DEPARTMENT_VALIDATION` | `8084`, `course-service`, `validate`, `false`, `always`, …, `strict` |
| OpenAPI / Swagger | `SPRINGDOC_SWAGGER_UI_PATH`, `SPRINGDOC_API_DOCS_PATH`, `APP_OPENAPI_TITLE`, `APP_OPENAPI_VERSION`, `APP_OPENAPI_DESCRIPTION` | `/swagger-ui.html`, `/v3/api-docs`, … |
| MySQL container   | `MYSQL_IMAGE`, `MYSQL_ROOT_PASSWORD`, `DB_CONTAINER_NAME`, `DB_CONTAINER_PORT`, `DB_HOST_PORT`                   | `mysql:8.0`, `rootpass`, … |
| Service container | `SERVICE_IMAGE`, `SERVICE_CONTAINER_NAME`                                                                       | `course-service:latest`, `course-service` |
| SonarQube stack   | `SONAR_PORT`, `SONAR_IMAGE`, `SONAR_CONTAINER_NAME`, `SONAR_DB_IMAGE`, `SONAR_DB_CONTAINER_NAME`, `SONAR_DB_USER`, `SONAR_DB_PASSWORD`, `SONAR_DB_NAME`, `SONAR_JDBC_URL`, `SONAR_ES_BOOTSTRAP_CHECKS_DISABLE` | `9000`, `sonarqube:26.10.0.133078-community`, … |

Credentials for the CI pipeline (SonarQube token) live in `course-service/.env` as
`SONAR_TOKEN` (git-ignored; copy `course-service/.env.example` as a starting point).

Key behaviour:

- Hibernate `ddl-auto=validate` — the schema is **never** generated from the entities.
- `schema.sql` is applied on startup (single source of truth for the DDL: unique `code`,
  CHECK `credits` 1–30, CHECK `status` in `ACTIVE`/`ARCHIVED`).
- Department integrity check — `APP_DEPARTMENT_VALIDATION`: `strict` (default) verifies
  `departmentId` against `department-service` on every create/update, returning `404` for an
  unknown department and `503` (no write) when that service cannot be reached. `off` never
  calls it at all — used by the standalone stack, where departments are referenced by id only.
  Any other value behaves like `strict`, so a mistyped value fails safe.
- Actuator exposes `health` and `info`; Swagger at `/swagger-ui.html`, spec at `/v3/api-docs`
  (all configurable).
- Business/API-contract constants (max page size, allowed sort fields, default sort, MySQL
  duplicate-code detection) stay in code — they don't vary per environment. JaCoCo thresholds are
  Maven properties (`-Djacoco.line.min`, `-Djacoco.branch.min`); the SonarQube host is **not**
  hardcoded (defaults to `http://localhost:9000`, overridable via `-Dsonar.host.url`/`SONAR_HOST_URL`).

---

## 4. Running

### 4.1 Standalone with Docker Compose (recommended)

```bash
docker compose up -d --build
```

This starts MySQL (`course-db`, host port `3308`) and the service (`course-service`, port `8084`)
in standalone mode. Both containers have health checks; the service waits for the database to be
healthy before it starts.

> **What works standalone:** reading courses, creating and updating them, and `/actuator/health`,
> with no other service running. This stack sets `APP_DEPARTMENT_VALIDATION=off`, so `departmentId`
> is stored exactly as given and `department-service` is never contacted — there is none here.
> Platform mode keeps the default `strict`: `departmentId` is verified, an unknown department
> returns `404`, and an unreachable `department-service` returns `503` rather than writing.

| Endpoint          | URL                                       |
|-------------------|-------------------------------------------|
| API base          | `http://localhost:8084/api/courses`       |
| Swagger UI        | `http://localhost:8084/swagger-ui.html`   |
| OpenAPI JSON      | `http://localhost:8084/v3/api-docs`       |
| Health (actuator) | `http://localhost:8084/actuator/health`   |

Stop:

```bash
docker compose down       # keep data
docker compose down -v    # also delete the DB volume
```

> To run the service as part of the real platform (Config Server + Eureka + department-service),
> use the repository root's `docker-compose.yml` instead — it starts the whole stack.

### 4.2 Locally against your own MySQL

```bash
# provision a database/user matching the defaults, then start in standalone mode:
SPRING_CLOUD_CONFIG_ENABLED=false EUREKA_CLIENT_ENABLED=false APP_DEPARTMENT_VALIDATION=off \
SPRING_DATASOURCE_URL="jdbc:mysql://localhost:3308/course_db?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC" \
SPRING_DATASOURCE_USERNAME=course_user SPRING_DATASOURCE_PASSWORD=course_pass \
mvn spring-boot:run
```

---

## 5. API

Base path: `/api/courses`. All bodies are JSON. Errors share one uniform shape.

| Method   | Path                         | Description                          | Success | Errors        |
|----------|------------------------------|--------------------------------------|---------|---------------|
| `POST`   | `/api/courses`               | Create a course (starts `ACTIVE`)    | `201`   | `400`, `404`, `409`, `503` |
| `GET`    | `/api/courses/{id}`          | Get a course by id                   | `200`   | `404`         |
| `GET`    | `/api/courses`               | List courses (filter + paging)       | `200`   | `400`         |
| `PUT`    | `/api/courses/{id}`          | Update mutable fields (status kept)  | `200`   | `400`, `404`, `409`, `503` |
| `DELETE` | `/api/courses/{id}`          | Archive a course (idempotent)        | `204`   | `404`         |
| `PATCH`  | `/api/courses/{id}/activate` | Activate a course (idempotent)       | `200`   | `404`         |

**List query parameters:** `departmentId`, `status` (`ACTIVE`|`ARCHIVED`), `page` (≥0, default 0),
`size` (1–100, default 20), `sort` (`field` or `field,direction`, default `code,asc`).
Allowed sort fields: `id`, `code`, `title`, `credits`, `createdAt`.

### Example

```bash
curl -X POST http://localhost:8084/api/courses \
  -H 'Content-Type: application/json' \
  -d '{"code":"CS101","title":"Intro","description":"desc","credits":6,"departmentId":1}'
```

```json
{
  "content": [
    {
      "id": 1, "code": "CS101", "title": "Intro", "description": "desc",
      "credits": 6, "departmentId": 1, "status": "ACTIVE",
      "createdAt": "2026-10-13T18:37:49.030984", "updatedAt": "2026-10-13T18:37:49.0311"
    }
  ],
  "page": 0, "size": 20, "totalElements": 1, "totalPages": 1, "first": true, "last": true
}
```

### Error model

```json
{
  "timestamp": "2026-10-13T18:40:00Z",
  "status": 400,
  "error": "Bad Request",
  "message": "Validation failed",
  "path": "/api/courses",
  "fieldErrors": [ { "field": "code", "message": "code must not be blank" } ]
}
```

`fieldErrors` is empty unless the failure is request validation.

---

## 6. Testing

```bash
mvn -B test      # all tests (Docker must be running)
mvn -B verify    # tests + JaCoCo report + coverage gate (LINE ≥ 90 %, BRANCH ≥ 80 %)
```

Test layers:

- **Unit** — `CourseServiceImplTest` (service logic, duplicate-race detection, sort/paging validation)
- **Web slice** — `CourseControllerTest` (`@WebMvcTest`: status codes, error bodies)
- **Persistence slice** — `CourseRepositoryTest` (`@DataJpaTest` on a real MySQL container:
  unique key + CHECK constraints, filters, paging, sorting)
- **End-to-end** — `CourseServiceApplicationTests` (full context boot + real HTTP via `TestRestTemplate`)

A single MySQL 8.0 Testcontainer is shared across the DB-backed tests.

### Trying the API by hand

With the stack running, a couple of quick checks (curl):

```bash
curl http://localhost:8084/actuator/health
curl http://localhost:8084/api/courses
curl http://localhost:8084/api/courses/1
curl -X DELETE http://localhost:8084/api/courses/1                       # archive -> 204
curl -X PATCH http://localhost:8084/api/courses/1/activate               # activate -> 200
```

Posting the same `code` twice returns `409`; an unknown id returns `404`; an invalid body
returns `400` with `fieldErrors`.

---

## 7. Docker

`Dockerfile` is a multi-stage build: Maven builds the fat jar in the builder stage, then the
runtime image (`eclipse-temurin:17-jre-alpine`) runs it as an unprivileged `app` user and exposes
a container-level health check against `/actuator/health`.

```bash
docker build -t course-service:latest .
docker compose up -d --no-build
docker compose ps                     # status + health
docker compose logs -f course-service
```

---

## 8. SonarQube

```bash
docker compose -f docker-compose.sonar.yml up -d   # SonarQube + PostgreSQL on http://localhost:9000
mvn -B verify                                       # produces target/site/jacoco/jacoco.xml
mvn -B sonar:sonar -Dsonar.token=$SONAR_TOKEN
```

The scan reads the JaCoCo XML report and the exclusions configured in `pom.xml`
(`CourseServiceApplication`, `config/**`).

**One-time manual setup** (no automation; the scanner needs a token and the pipeline needs
a quality gate):

1. Start the stack (above) and open `http://localhost:9000`. First login is `admin` / `admin`
   and SonarQube 26.10 forces an immediate password change (12+ characters).
2. My Account → Security → Generate Token (name it e.g. `jenkins-ci`).
3. Quality Gates → create a gate named `course-service` with error-level conditions:
   `new_violations > 0`, `new_coverage < 90`, `new_duplicated_lines_density > 3`
   (leave "All new Security Hotspots reviewed" out), then **Set as Default**
   (or assign the gate to the `course-service` project).
4. Put the token in `jenkin-docker/.env` as `SONAR_TOKEN=<token>` — the shared Jenkins
   controller injects it as the `sonar-token` credential (see
   [`jenkin-docker/.env.example`](../jenkin-docker/.env.example)).

## 9. CI (Jenkins)

`Jenkinsfile` (declarative) implements: checkout → `mvn clean verify` → SonarQube analysis →
quality gate → Docker build → compose smoke test, publishing the JUnit and JaCoCo reports. The
smoke test starts the service from the image just built and fails the build if it never reports
`UP` on `/actuator/health`.

The scanner authenticates with the `sonar-token` Jenkins credential (a plain string sourced
from the `SONAR_TOKEN` environment variable, wired by
[`jenkin-docker/casc.yaml`](../jenkin-docker/casc.yaml)). The shared Compose setup registers
one controller webhook for the pipelines that use `waitForQualityGate`; this pipeline still
polls the web API for its verdict because SonarQube 26.10 rejects webhook targets that
resolve to site-local addresses such as `host.docker.internal`. It reads the `ceTaskId` from `target/sonar/report-task.txt`, waits
for `/api/ce/task` to reach `SUCCESS`, then evaluates `/api/qualitygates/project_status`
(`OK`/`WARN` pass, anything else fails the build). `jq` is required by that stage and is baked
into the shared controller image ([`jenkin-docker/Dockerfile.jenkins`](../jenkin-docker/Dockerfile.jenkins)).

It expects a JDK tool named `jdk17`, a Maven tool named `maven-3.9` (both declared in
[`jenkin-docker/casc.yaml`](../jenkin-docker/casc.yaml)) and the `sonar-token` credential; everything else is overridable
through *Build with Parameters*. The Jenkins controller used for this pipeline is described by
[`jenkin-docker/docker-compose.jenkins.yml`](../jenkin-docker/docker-compose.jenkins.yml) and configured by [`jenkin-docker/casc.yaml`](../jenkin-docker/casc.yaml).

---

## 10. Reports

| What | Where |
|------|-------|
| Test results | `target/surefire-reports/` |
| Coverage (HTML) | `target/site/jacoco/index.html` |
| Coverage (XML, for Sonar) | `target/site/jacoco/jacoco.xml` |
| Mutation (optional) | `target/pit-reports/index.html` |
| SonarQube dashboard | `http://localhost:9000` |

Optional mutation testing:

```bash
mvn -Pmutation test-compile org.pitest:pitest-maven:mutationCoverage
```

---

## 11. Project structure

```
course-service/
├── Dockerfile                  # multi-stage, non-root runtime
├── ../jenkin-docker/Dockerfile.jenkins # shared Jenkins controller image
├── docker-compose.yml          # standalone stack: app + MySQL
├── ../jenkin-docker/docker-compose.jenkins.yml # shared Jenkins controller
├── docker-compose.sonar.yml    # SonarQube + PostgreSQL
├── .env.example                # template for SONAR_TOKEN (git-ignored .env)
├── Jenkinsfile
├── ../jenkin-docker/casc.yaml # Configuration as Code for the controller
├── pom.xml
├── README.md
└── src
    ├── main
    │   ├── java/com/eduplatform/course
    │   │   ├── config/         # OpenAPI metadata
    │   │   ├── controller/     # REST layer (DTOs only)
    │   │   ├── dto/            # request/response records
    │   │   ├── entity/         # Course, CourseStatus
    │   │   ├── exception/      # domain exceptions + global handler
    │   │   ├── mapper/         # entity <-> DTO
    │   │   ├── repository/     # Spring Data JPA
    │   │   └── service/        # business logic
    │   └── resources/
    │       ├── application.yml
    │       └── schema.sql      # DDL (source of truth)
    └── test
        └── java/com/eduplatform/course
            ├── support/        # shared Testcontainers setup
            └── ...             # unit, web, repository and E2E tests
```

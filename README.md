# GL5-G4 Student Management Platform

A Spring Boot microservices platform for managing students, courses, departments and
enrollments. All runtime configuration is served by a **Config Server** backed by a
private Git repository, services register with **Eureka**, each service owns its own
**MySQL** database, and the whole stack runs with a single **Docker Compose** command.

## Architecture

```
                        +---------------------+
                        |    API Gateway      |  :8072   (single entry point)
                        | /department         |  routes to every service below
                        | /course /enrollment |
                        | /student            |
                        +----------+----------+
                                   | lb://<service-id> (resolved via Eureka)
                        +----------+----------+
                        |   Config Server     |  :8071  (Basic Auth)
                        |  Git-backed config  |<---------+
                        +---------------------+          |
                                                          | spring.config.import
                        +---------------------+          |
                        |   Eureka Server     |  :8761   |
                        +---------------------+          |
                              ^    ^    ^    ^             |
                              |    |    |    |  register   |
        +---------------------+----+----+----+-------------+-----------------+
        |            |             |             |                          |
  department     enrollment      course        student                     |
   :8082          :8083         :8084          :8085                       |
  /department    /enrollment    /course        /student                    |
        |            |             |             |                          |
   department-db  enrollment-db  course-db    student-db                    |
     :3306          :3307        :3308         :3309                       |
        +------------+-------------+-------------+--------------------------+
                                        gl5-net (bridge network)
```

Each service starts by importing its configuration from the Config Server
(`spring.config.import=optional:configserver:...`). Datasource passwords are stored as
`{cipher}` values in the config repository and decrypted **server-side** by the Config
Server, so the services never see the symmetric key.

## Prerequisites

- **Docker Engine** with **Docker Compose v2** (`docker compose version`).
- **Git** and network access to GitHub.
- Access to the project's **private configuration repository**
  (`https://github.com/Chaabane2k03/config-repo.git`) and a **Personal Access Token**
  with read access to it.
- The project's **`ENCRYPT_KEY`** (see [Configuration secrets](#configuration-secrets)).
- Enough free RAM for the containers (4 MySQL + 7 JVMs); ~4 GB is comfortable.

> All images are built from source inside Docker, so a local JDK/Maven installation is
> **not** required to run the stack.

## Quick start (Docker)

### 1. Clone the repository

```sh
git clone git@github.com:Chaabane2k03/GL5-G4-student.git
cd GL5-G4-student
```

### 2. Create the Config Server environment file

The Config Server reads its credentials and Git settings from `config-server/.env`.
That file is git-ignored, so create it from the committed example:

```sh
cp config-server/.env.example config-server/.env
```

Then edit `config-server/.env` and fill in the real values:

| Variable          | Description                                                                                              |
| ----------------- | -------------------------------------------------------------------------------------------------------- |
| `CONFIG_REPO_URI` | URL of the private config repository (`https://github.com/Chaabane2k03/config-repo.git`).                |
| `GIT_USER`        | GitHub username that owns the token.                                                                     |
| `GIT_TOKEN`       | Personal Access Token with read access to the config repository.                                         |
| `CONFIG_USER`     | Basic Auth username for the Config Server (also used by the services to fetch their config).             |
| `CONFIG_PASSWORD` | Basic Auth password for the Config Server.                                                               |
| `ENCRYPT_KEY`     | Symmetric key used to decrypt `{cipher}` values. **Must match the key used to encrypt the config repo.** |

Example:

```dotenv
CONFIG_REPO_URI=https://github.com/Chaabane2k03/config-repo.git
GIT_USER=Chaabane2k03
GIT_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
CONFIG_USER=config
CONFIG_PASSWORD=change-me-to-a-strong-password
ENCRYPT_KEY=the-project-shared-encryption-key
```

> Never commit `.env`. It is already listed in `.gitignore`.

### 3. Build and start the whole stack

```sh
docker compose up -d --build
```

The first run pulls the MySQL/Maven/JRE base images and builds seven service images, so it
can take several minutes. Compose starts the databases and the Config Server first
(waits until they are healthy), then starts Eureka and the four business services, and
finally the API Gateway.

### 4. Check that everything is up

```sh
docker compose ps
```

All containers should report `(healthy)` once the start-up grace periods elapse
(roughly 60–90 seconds).

## Service endpoints

| Service             | Container               | Port   | Context path    |
| ------------------- | ----------------------- | ------ | --------------- |
| API Gateway         | `gl5-api-gateway`       | `8072` | `/` (routes below) |
| Config Server       | `gl5-config-server`     | `8071` | `/`             |
| Eureka Server       | `gl5-eureka-server`     | `8761` | `/`             |
| Department Service  | `gl5-department-service`| `8082` | `/department`   |
| Enrollment Service  | `gl5-enrollment-service`| `8083` | `/enrollment`   |
| Course Service      | `gl5-course-service`    | `8084` | `/course`       |
| Student Service     | `gl5-student-service`   | `8085` | `/student`      |

MySQL databases are also published on the host: course `3308`, department `3310`,
enrollment `3307`, student `3309`.

The API Gateway is the recommended single entry point. It exposes each service under its
own context path and resolves the backing instances through Eureka (`lb://<service-id>`):

| Gateway path      | Backend             |
| ----------------- | ------------------- |
| `/department/**`  | department-service  |
| `/course/**`      | course-service      |
| `/enrollment/**`  | enrollment-service  |
| `/student/**`     | student-service     |

### Verify

```sh
# Eureka dashboard (browser):       http://localhost:8761
# Swagger UI (browser):             http://localhost:8072/swagger-ui.html
# Service health (direct):          all return {"status":"UP"}
curl http://localhost:8082/department/actuator/health
curl http://localhost:8083/enrollment/actuator/health
curl http://localhost:8084/course/actuator/health
curl http://localhost:8085/student/actuator/health

# Same endpoints through the API Gateway
curl http://localhost:8072/department/actuator/health
curl http://localhost:8072/course/actuator/health

# Gateway health (no context path)
curl http://localhost:8072/actuator/health

# Config Server (Basic Auth required)
curl -u "$CONFIG_USER:$CONFIG_PASSWORD" http://localhost:8071/actuator/health
```

### Example API calls

```sh
# Through the API Gateway (single entry point)
curl http://localhost:8072/department/api/departments
curl http://localhost:8072/course/api/courses
curl http://localhost:8072/student/students/getAllStudents
curl http://localhost:8072/enrollment/Enrollment/getAllEnrollment

# Or directly against each service (same paths, different port)
curl http://localhost:8082/department/api/departments
curl http://localhost:8084/course/api/courses
curl http://localhost:8085/student/students/getAllStudents
curl http://localhost:8083/enrollment/Enrollment/getAllEnrollment

# Create a department
curl -X POST http://localhost:8072/department/api/departments \
  -H "Content-Type: application/json" \
  -d '{"name":"Informatique","code":"INF"}'
```

## Swagger / OpenAPI

Every backend service serves its own documentation under its context path
(Swagger UI at `/swagger-ui.html`, spec at `/v3/api-docs`), and the API Gateway provides a
single aggregated Swagger UI:

| Documentation                    | URL                                                       |
| -------------------------------- | --------------------------------------------------------- |
| **All services (via gateway)**   | `http://localhost:8072/swagger-ui.html`                    |
| Department (direct)              | `http://localhost:8082/department/swagger-ui.html`         |
| Enrollment (direct)              | `http://localhost:8083/enrollment/swagger-ui.html`         |
| Course (direct)                  | `http://localhost:8084/course/swagger-ui.html`             |
| Student (direct)                 | `http://localhost:8085/student/swagger-ui.html`            |
| Gateway spec                     | `http://localhost:8072/v3/api-docs`                        |

The gateway UI exposes a definition selector listing the four backend services; their
documents are fetched through the gateway itself (`/department/v3/api-docs`, …). Requests
sent with **Try it out** therefore go through the gateway route, not directly to the
service. See [`api-gateway/README.md`](./api-gateway/README.md) for details.

## Reading configuration from the Config Server

```sh
# Each service's configuration for a given profile (dev, prod, docker, ...)
curl -u "$CONFIG_USER:$CONFIG_PASSWORD" \
  http://localhost:8071/course-service/docker
```

## Configuration secrets

Secrets are stored in the config repository as `{cipher}...` values and are decrypted by
the Config Server before being served. The Config Server exposes CSRF-protected
`/encrypt` and `/decrypt` endpoints. `/csrf` returns a token that must be sent (together
with the same session cookie) on those POSTs:

```sh
curl -u "$CONFIG_USER:$CONFIG_PASSWORD" -c cookies.txt http://localhost:8071/csrf

curl -u "$CONFIG_USER:$CONFIG_PASSWORD" -b cookies.txt \
  -H "X-CSRF-TOKEN: <token from /csrf>" \
  -H "Content-Type: text/plain" \
  --data 'value-to-encrypt' \
  http://localhost:8071/encrypt
```

See [`config-server/README.md`](./config-server/README.md) for details on CSRF,
encryption and the native (no-Git) profile.

## Useful commands

```sh
# Follow logs of a single service
docker compose logs -f config-server
docker compose logs -f course-service

# Restart one service after changing code
docker compose up -d --build course-service

# Stop everything (keep database data)
docker compose down

# Stop everything and delete database volumes
docker compose down -v
```

## Code quality (SonarQube)

A shared SonarQube instance (plus its PostgreSQL database) is defined in
`docker-compose.sonar.yml`. It is independent of the application stack: both can run at the
same time, and `docker compose down -v` on the application stack never deletes SonarQube data.

```sh
# Start SonarQube + its database (http://localhost:9000)
docker compose -f docker-compose.sonar.yml up -d

# Follow the start-up log
docker compose -f docker-compose.sonar.yml logs -f sonarqube

# Stop it (keep analysis history) / stop it and delete the history
docker compose -f docker-compose.sonar.yml down
docker compose -f docker-compose.sonar.yml down -v
```

> `course-service/docker-compose.sonar.yml` is a per-service variant of the same stack.
> Don't run both — they both publish port 9000. Use the root compose file to analyse
> every service from a single SonarQube instance.

**One-time setup:** open `http://localhost:9000` (first login `admin` / `admin`; a password
change is forced), then **My Account → Security → Generate Token**. Export the token:

```sh
export SONAR_TOKEN='<token>'      # bash
$env:SONAR_TOKEN = '<token>'      # PowerShell
```

Build, test, measure coverage and scan **every service** with a single command:

```powershell
.\sonar-scan-all.ps1
```

Useful variants:

```powershell
.\sonar-scan-all.ps1 -Services course-service,department-service  # subset of services
.\sonar-scan-all.ps1 -SkipQualityGate                            # do not wait for the gate
.\sonar-scan-all.ps1 -FailOnQualityGate                          # fail when the gate is not OK/WARN
```

For each service the script runs `mvn clean verify` (unit, slice and E2E tests, plus the JaCoCo
report and, where configured, the coverage gate) followed by the Sonar scanner, waits for the
compute engine and prints a summary with tests, line coverage and quality-gate status. Every
service is a separate SonarQube project whose key is its directory name (for example
`course-service`). All seven poms declare the `sonar-maven-plugin`, so `mvn sonar:sonar` also
works standalone (the script calls the fully qualified goal so it never depends on prefix
resolution).

The equivalent manual command for a single service is:

```sh
cd course-service
../mvnw -B clean verify sonar:sonar \
  -Dsonar.host.url=http://localhost:9000 \
  -Dsonar.token=$SONAR_TOKEN \
  -Dsonar.projectKey=course-service
```

## Troubleshooting

| Symptom | Likely cause / fix |
| ------- | ------------------ |
| `config-server` unhealthy / logs show `Authentication is required` or clone failures | Missing/invalid `GIT_TOKEN` or `CONFIG_REPO_URI` in `config-server/.env`. |
| Services exit with `Could not resolve placeholder` or DB connection errors | `ENCRYPT_KEY` does not match the key used to encrypt the config repository, so `{cipher}` values cannot be decrypted. Use the shared project key. |
| Services return `401`/`Connection refused` to the Config Server | `CONFIG_USER`/`CONFIG_PASSWORD` must be identical in `config-server/.env` (they are reused by every service). |
| A service is `unhealthy` but the app is running | Health checks use the context path (e.g. `/course/actuator/health`). Allow the ~60 s start-up grace period before investigating. |
| Requests to `http://localhost:8072/<service>/...` return `503 Service Unavailable` | The gateway could not resolve a healthy instance. Wait ~30 s after start-up (Eureka registration interval) or check the target service in the Eureka dashboard. |
| Build fails for a service | Make sure you used `docker compose up -d --build` (never pass `--no-build`); all services build from source. |

## Observability (Prometheus + Grafana + Jaeger + Loki)

The applications expose Prometheus-compatible metrics at their Actuator endpoints and
emit distributed traces through OTLP. Start the monitoring tools separately from the
application stack:

```sh
docker compose -f docker-compose.observability.yml up -d
```

Then open:

- Prometheus: http://localhost:9090
- Grafana: http://localhost:3000 (`admin` / `admin` for local development)
- Jaeger: http://localhost:16686
- Loki: http://localhost:3100
- Grafana dashboard: **GL5-G4 / GL5-G4 Spring Services**

Jaeger receives OTLP/HTTP traces on `localhost:4318`. Host-run applications use this
endpoint by default. The main Docker Compose file sets
`OTEL_EXPORTER_OTLP_ENDPOINT=http://host.docker.internal:4318/v1/traces` for containerized
services, so the same Jaeger instance receives traces from either deployment mode.
Sampling defaults to 100% for local development and can be adjusted with
`TRACING_SAMPLING_PROBABILITY`.

On Docker Engine for Linux the `host.docker.internal` name is not resolved by default, so
every service in `docker-compose.yml` declares
`extra_hosts: ["host.docker.internal:host-gateway"]`. Without it the OTLP exporter logs
`UnknownHostException: host.docker.internal` and no trace reaches Jaeger. Docker Desktop
resolves the name natively and ignores the mapping.

A request is traceable across services: the Feign clients of `course-service` and
`enrollment-service` are instrumented with `feign-micrometer`, so every call creates a
CLIENT span and propagates the W3C trace context (`traceparent`) to the called service.
The resulting trace shows the caller server span, the Feign client span and the callee
server span in one place in Jaeger.

Loki stores container logs and Grafana Alloy discovers Docker containers through the
Docker socket and forwards their structured JSON logs to Loki. Logs are available in
Grafana through the provisioned Loki data source. The Alloy container requires Docker
Desktop's Docker socket to be available.

Prometheus scrapes the Eureka server, API Gateway, and four business services from
the host using `host.docker.internal`. Start the application stack first with
`docker compose up -d --build`. The Config Server is intentionally not scraped
because its Actuator endpoints require Basic Authentication.

The main Compose file explicitly enables the gateway's Prometheus endpoint through
an environment override, so local scraping works even when the external Config
Server repository has not yet been updated with the observability properties.

Direct metric endpoints are:

```sh
curl http://localhost:8761/actuator/prometheus
curl http://localhost:8072/actuator/prometheus
curl http://localhost:8082/department/actuator/prometheus
curl http://localhost:8083/enrollment/actuator/prometheus
curl http://localhost:8084/course/actuator/prometheus
curl http://localhost:8085/student/actuator/prometheus
```

The Actuator exposure is limited to health, info, and Prometheus metrics. Console
logs use Spring Boot's structured JSON format for collection by Alloy and Loki.

`feign-micrometer` registers the Feign calls under the same metric name as Spring Boot's
own HTTP client instrumentation (`http.client.requests`) but with a different set of tag
keys, which Prometheus rejects. `ObservabilityConfig` denies the Feign variant so the
canonical metric stays exposed and the registry stays consistent; the Feign calls stay
visible as client spans in the traces.

For the proposed resilience, messaging, CI/CD, security, and deployment roadmap, see
[`ARCHITECTURE-ROADMAP.md`](./ARCHITECTURE-ROADMAP.md).

## Project layout

```
.
├── config-server/       # Centralized Config Server (Git backend, encrypted values)
├── eureka-server/       # Service registry
├── api-gateway/         # Single entry point + Swagger UI aggregation (routes below)
├── department-service/  # Department CRUD API      (context path /department)
├── enrollment-service/  # Enrollment CRUD API       (context path /enrollment)
├── course-service/      # Course CRUD API           (context path /course)
├── student-service/     # Student CRUD API          (context path /student)
├── docker-compose.yml   # Full local stack
├── docker-compose.sonar.yml  # Shared SonarQube + PostgreSQL
├── sonar-scan-all.ps1   # Build, test and scan every service
└── terraform/           # Infrastructure as code (deployment, managed separately)
```

Configuration for each service/profile lives in the separate private repository
`config-repo`, for example `api-gateway.properties`, `api-gateway-docker.properties`,
`course-service.properties`, `course-service-docker.properties`,
`student-service-dev.properties`, and so on.

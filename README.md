# GL5-G4 Student Management Platform

A Spring Boot microservices platform for managing students, courses, departments and
enrollments. All runtime configuration is served by a **Config Server** backed by a
private Git repository, services register with **Eureka**, each service owns its own
**MySQL** database, and the whole stack runs with a single **Docker Compose** command.

## Architecture

```
                        +---------------------+
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
- Enough free RAM for the containers (MySQL + 6 JVMs); ~4 GB is comfortable.

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

The first run pulls the MySQL/Maven/JRE base images and builds six service images, so it
can take several minutes. Compose starts the databases and the Config Server first
(waits until they are healthy), then starts Eureka and the four business services.

### 4. Check that everything is up

```sh
docker compose ps
```

All containers should report `(healthy)` once the start-up grace periods elapse
(roughly 60–90 seconds).

## Service endpoints

| Service             | Container               | Port   | Context path    |
| ------------------- | ----------------------- | ------ | --------------- |
| Config Server       | `gl5-config-server`     | `8071` | `/`             |
| Eureka Server       | `gl5-eureka-server`     | `8761` | `/`             |
| Department Service  | `gl5-department-service`| `8082` | `/department`   |
| Enrollment Service  | `gl5-enrollment-service`| `8083` | `/enrollment`   |
| Course Service      | `gl5-course-service`    | `8084` | `/course`       |
| Student Service     | `gl5-student-service`   | `8085` | `/student`      |

MySQL databases are also published on the host: course `3308`, department `3306`,
enrollment `3307`, student `3309`.

### Verify

```sh
# Eureka dashboard (browser):      http://localhost:8761
# Service health (through gateway): all return {"status":"UP"}
curl http://localhost:8082/department/actuator/health
curl http://localhost:8083/enrollment/actuator/health
curl http://localhost:8084/course/actuator/health
curl http://localhost:8085/student/actuator/health

# Config Server (Basic Auth required)
curl -u "$CONFIG_USER:$CONFIG_PASSWORD" http://localhost:8071/actuator/health
```

### Example API calls

```sh
# List resources
curl http://localhost:8082/department/api/departments
curl http://localhost:8084/course/api/courses
curl http://localhost:8085/student/students/getAllStudents
curl http://localhost:8083/enrollment/Enrollment/getAllEnrollment

# Create a department
curl -X POST http://localhost:8082/department/api/departments \
  -H "Content-Type: application/json" \
  -d '{"name":"Informatique","code":"INF"}'
```

Interactive API docs (Swagger UI) are available under each service's context path, e.g.
`http://localhost:8084/course/swagger-ui/index.html`.

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

## Troubleshooting

| Symptom | Likely cause / fix |
| ------- | ------------------ |
| `config-server` unhealthy / logs show `Authentication is required` or clone failures | Missing/invalid `GIT_TOKEN` or `CONFIG_REPO_URI` in `config-server/.env`. |
| Services exit with `Could not resolve placeholder` or DB connection errors | `ENCRYPT_KEY` does not match the key used to encrypt the config repository, so `{cipher}` values cannot be decrypted. Use the shared project key. |
| Services return `401`/`Connection refused` to the Config Server | `CONFIG_USER`/`CONFIG_PASSWORD` must be identical in `config-server/.env` (they are reused by every service). |
| A service is `unhealthy` but the app is running | Health checks use the context path (e.g. `/course/actuator/health`). Allow the ~60 s start-up grace period before investigating. |
| Build fails for a service | Make sure you used `docker compose up -d --build` (never pass `--no-build`); all services build from source. |

## Project layout

```
.
├── config-server/       # Centralized Config Server (Git backend, encrypted values)
├── eureka-server/       # Service registry
├── department-service/  # Department CRUD API      (context path /department)
├── enrollment-service/  # Enrollment CRUD API       (context path /enrollment)
├── course-service/      # Course CRUD API           (context path /course)
├── student-service/     # Student CRUD API          (context path /student)
├── docker-compose.yml   # Full local stack
└── terraform/           # Infrastructure as code (deployment, managed separately)
```

Configuration for each service/profile lives in the separate private repository
`config-repo`, for example `course-service.properties`,
`course-service-docker.properties`, `student-service-dev.properties`, and so on.

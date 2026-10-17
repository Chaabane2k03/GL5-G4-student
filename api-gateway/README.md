# API Gateway

Spring Cloud Gateway (WebFlux) edge service for the GL5-G4 student management platform.
It is the **single entry point** to the backend services: it exposes each one under its own
context path, resolves the target instance through **Eureka**, and serves one **aggregated
Swagger UI** for the whole platform.

Built with **Spring Boot 3.5.5** on **Java 17**, packaged with a multi-stage Docker image.

---

## 1. Routing

Routes are declared explicitly (the Eureka auto-locator is disabled) in
[`src/main/resources/application.properties`](src/main/resources/application.properties) and
mirrored in the private `config-repo` (`api-gateway.properties`, `api-gateway-docker.properties`).

| Gateway path      | URI (`lb://` = resolved via Eureka) | Backend             | Backend context path |
| ----------------- | ----------------------------------- | ------------------- | -------------------- |
| `/department/**`  | `lb://department-service`           | department-service  | `/department`        |
| `/course/**`      | `lb://course-service`               | course-service      | `/course`            |
| `/enrollment/**`  | `lb://enrollment-service`           | enrollment-service  | `/enrollment`        |
| `/student/**`     | `lb://student-service`              | student-service     | `/student`           |

Each backend keeps its own `server.servlet.context-path`, so the full path is forwarded
as-is — no `StripPrefix` is needed. `lb://` makes the same configuration work on localhost
and inside the Docker network, because the instance host/port always comes from Eureka.

Example:

```sh
curl http://localhost:8072/course/api/courses      # -> course-service:8084/course/api/courses
```

A `PreserveHostHeader` default filter is applied to every route so that the original `Host`
header (`localhost:8072`) reaches the backend. This is what makes the generated OpenAPI
`servers` URLs point back at the gateway (see §3).

> `lb://` routing requires a LoadBalancer implementation. The Eureka client starter does not
> bring one, so the gateway depends on `spring-cloud-starter-loadbalancer`; without it every
> `lb://` route fails with `503 Service Unavailable`.

---

## 2. Requirements

- JDK 17+ and Maven 3.9+ (or the repository wrapper `./mvnw`).
- A running **Eureka Server**, otherwise `lb://` routes cannot resolve any instance.
- A running **Config Server** for the standard configuration (the import is optional, so the
  gateway still starts without it, using the defaults in `application.properties`).

---

## 3. Swagger / OpenAPI

The gateway serves its own document and aggregates the four backend documents in a single UI.
Each definition is fetched **through the gateway routes**, so this works without the browser
needing direct access to the backend ports.

| Documentation                  | URL                                          |
| ------------------------------ | -------------------------------------------- |
| Aggregated Swagger UI          | `http://localhost:8072/swagger-ui.html`      |
| Gateway's own spec             | `http://localhost:8072/v3/api-docs`          |
| Department spec (via gateway)  | `http://localhost:8072/department/v3/api-docs` |
| Course spec (via gateway)      | `http://localhost:8072/course/v3/api-docs`   |
| Enrollment spec (via gateway)  | `http://localhost:8072/enrollment/v3/api-docs` |
| Student spec (via gateway)     | `http://localhost:8072/student/v3/api-docs`  |

Configuration (`application.properties`):

```properties
springdoc.swagger-ui.path=/swagger-ui.html
springdoc.swagger-ui.urls[0].name=Department Service
springdoc.swagger-ui.urls[0].url=/department/v3/api-docs
# ... one entry per service
```

Because `PreserveHostHeader` keeps `Host: localhost:8072`, each backend's springdoc computes
`servers: [{ "url": "http://localhost:8072/<context-path>" }]`, so **Try it out** sends the
request back through the gateway route instead of to an unroutable internal address.

API metadata for the gateway itself is defined in
[`OpenApiConfig`](src/main/java/tn/fst/apigateway/config/OpenApiConfig.java).

---

## 4. Actuator

| Endpoint                        | Description                                             |
| ------------------------------- | ------------------------------------------------------- |
| `/actuator/health`              | Health probe (used by the Docker health check)           |
| `/actuator/info`                | Build info                                               |
| `/actuator/gateway/routes`      | Active routes, predicates and filters                    |

The gateway endpoint is read-only (`management.endpoint.gateway.access=read-only`); set it to
`unrestricted` to also allow the runtime `POST`/`DELETE` route-management operations.

```sh
curl http://localhost:8072/actuator/gateway/routes
```

---

## 5. Run and build

Locally (Eureka and Config Server assumed to be running):

```sh
bash ./mvnw -f api-gateway/pom.xml spring-boot:run
```

The service listens on `http://localhost:8072`. Overridable environment variables:

| Variable            | Default                     |
| ------------------- | --------------------------- |
| `SERVER_PORT`       | `8072`                      |
| `EUREKA_URL`        | `http://localhost:8761/eureka/` |
| `CONFIG_SERVER_URL` | `http://localhost:8071`     |
| `CONFIG_USER` / `CONFIG_PASSWORD` | `config` / `change-me` |

Docker (build context is the repository root):

```sh
docker compose up -d --build api-gateway      # from the repository root
docker compose logs -f api-gateway
```

In Docker it runs with `SPRING_PROFILES_ACTIVE=docker` and fetches its environment-specific
configuration (port, Eureka URL) from the Config Server.

Tests:

```sh
bash ./mvnw -f api-gateway/pom.xml verify
```

The context-load test disables the Config Server and Eureka
(`src/test/resources/application.properties`), so it needs no external services.

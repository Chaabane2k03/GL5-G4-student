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
- A running **Keycloak** for JWT authentication and the JWKS endpoint.

## 3. Security (OAuth2 / OIDC & RBAC)

The gateway acts as an **OAuth2 Resource Server** validating JWT access tokens issued by an
OAuth2 / OpenID Connect Authorization Server (e.g., Keycloak, Auth0, Okta).

### Role-Based Access Control (RBAC) Matrix

Granted authorities are extracted by [`GrantedAuthoritiesExtractor`](src/main/java/tn/fst/apigateway/security/GrantedAuthoritiesExtractor.java),
which automatically maps standard `SCOPE_*` scopes as well as Keycloak realm roles (`realm_access.roles`),
client roles scoped exclusively to the gateway client (`resource_access.api-gateway.roles`), and normalized Keycloak groups (`/admins` -> `ROLE_ADMIN`).

| Domain / Path | Method | Required Role | Description |
|---|---|---|---|
| `/actuator/health/**`, `/actuator/info` | Any | **Public** | Docker / Kubernetes liveness & readiness probes |
| Preflight CORS (`OPTIONS /**`) | `OPTIONS` | **Public** | Always permitted without token for frontend SPAs |
| Swagger UI & Docs (`/swagger-ui/**`, `/v3/api-docs/**`) | Any | **Public** *(dev)* / `ROLE_ADMIN` *(prod)* | Configurable via `gateway.security.swagger-public` |
| `/actuator/gateway/**` | Any | `ROLE_ADMIN` | Runtime route inspection and administration |
| `/department/**` | `POST`, `PUT`, `DELETE` | `ROLE_ADMIN` | Departments managed strictly by administrators |
| `/department/**` | `GET` | **Authenticated** | Read access for authenticated users |
| `/course/**` | `POST`, `PUT` | `ROLE_ADMIN`, `ROLE_TEACHER` | Course creation/editing by teachers or admins |
| `/course/**` | `DELETE` | `ROLE_ADMIN` | Course deletion restricted to admins |
| `/course/**` | `GET` | **Authenticated** | Read access for authenticated users |
| `/enrollment/**` | `POST` | `ROLE_ADMIN`, `ROLE_STUDENT` | Course enrollment by students or admins |
| `/enrollment/**` | `PUT`, `DELETE` | `ROLE_ADMIN` | Altering/canceling enrollments restricted to admins |
| `/enrollment/**` | `GET` | **Authenticated** | Read access for authenticated users |
| `/student/**` | `POST` | `ROLE_ADMIN` | Student registration by administrators |
| `/student/**` | `PUT` | `ROLE_ADMIN`, `ROLE_STUDENT` | Profile updates by students or admins |
| `/student/**` | `DELETE` | `ROLE_ADMIN` | Student deletion restricted to admins |
| `/student/**` | `GET` | **Authenticated** | Read access for authenticated users |

> [!NOTE]
> Fine-grained record-level access control (e.g., verifying that a student only accesses their own grades/records) cannot be handled solely at the gateway path level and belongs inside the downstream services using JWT claims (`sub`, `preferred_username`).

### Configuration Properties

```properties
# OAuth2 Resource Server (JWT)
spring.security.oauth2.resourceserver.jwt.issuer-uri=${KEYCLOAK_ISSUER_URI:http://localhost:8080/realms/gl5}
spring.security.oauth2.resourceserver.jwt.jwk-set-uri=${JWK_SET_URI:}

# Gateway Security & Audience Settings
gateway.security.client-id=api-gateway
gateway.security.audience=api-gateway
gateway.security.swagger-public=${GATEWAY_SWAGGER_PUBLIC:true}
gateway.cors.allowed-origins=*
```

### Root Compose / Keycloak wiring

The root `gl5-g4-student` Compose stack runs Keycloak as the separate service
`keycloak-service` (container `gl5-keycloak-service`). The gateway validates its JWTs and
does not embed Keycloak. The relevant environment values are:

```yaml
KEYCLOAK_ISSUER_URI: http://localhost:8080/realms/gl5
JWK_SET_URI: http://keycloak-service:8080/realms/gl5/protocol/openid-connect/certs
```

- `KEYCLOAK_ISSUER_URI` is the browser-facing token issuer and must match the JWT `iss`.
- `JWK_SET_URI` is the internal Compose address used by the gateway to fetch signing keys.
  Using `localhost:8080` here would point at the gateway container itself.
- The gateway depends on `keycloak-service` with `condition: service_started`. Keycloak has
  no Docker healthcheck because its official image removes `curl`.

CORS is owned by the gateway:

- `gateway.cors.allowed-origins=*` is intentional for local development.
- `PreserveHostHeader` remains enabled for Swagger and backend routing.
- Backend controllers must not add `@CrossOrigin`; the annotation was removed from the
  student and enrollment controllers. No `DedupeResponseHeader` filter is needed, and adding
  one would only mask a duplicate CORS source.

### Authenticating Requests

Pass the JWT token in the `Authorization` header:

```sh
curl -H "Authorization: Bearer <your-jwt-token>" http://localhost:8072/course/api/courses
```

Or click the **Authorize** button in Swagger UI (`http://localhost:8072/swagger-ui.html`) to paste your Bearer token.

---

## 4. Swagger / OpenAPI

The gateway serves its own document and aggregates the four backend documents in a single UI.
Each definition is fetched **through the gateway routes**, so this works without the browser
needing direct access to the backend ports. The service selector, tags and operations are
sorted alphabetically, and endpoint groups start collapsed to keep the page easy to scan.

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
springdoc.swagger-ui.urls[0].name=Course Service
springdoc.swagger-ui.urls[0].url=/course/v3/api-docs
# ... one entry per service
springdoc.swagger-ui.tagsSorter=alpha
springdoc.swagger-ui.operationsSorter=alpha
springdoc.swagger-ui.docExpansion=none
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
| `KEYCLOAK_ISSUER_URI` | `http://localhost:8080/realms/gl5` |
| `JWK_SET_URI`       | empty (derived from issuer when possible) |

Docker (build context is the repository root):

```sh
docker compose up -d --build api-gateway      # from the repository root
docker compose logs -f api-gateway
```

In the full root stack, start everything with `docker compose up -d --build`. The gateway
runs with `SPRING_PROFILES_ACTIVE=docker`, fetches its environment-specific configuration
from the Config Server, and uses `keycloak-service` for JWKS.

Verification with a Keycloak token:

```sh
TOKEN=$(curl -s -X POST http://localhost:8080/realms/gl5/protocol/openid-connect/token \
  -d grant_type=password -d client_id=gl5-smoke -d username=admin -d password=admin \
  | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')

# Without a token: 401
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8072/department/api/departments

# With a valid token: 200
curl -s -o /dev/null -w '%{http_code}\n' \
  -H "Authorization: Bearer $TOKEN" http://localhost:8072/department/api/departments
```

Tests:

```sh
bash ./mvnw -f api-gateway/pom.xml verify
```

The `test` profile (`src/test/resources/application-test.properties`) disables the Config
Server and Eureka, so tests need no external services. The suite covers:

- `GatewayRouteConfigurationTest` — the routing table (`Path=/<ctx>/**` → `lb://<service-id>`),
  the disabled Eureka auto-locator, the `PreserveHostHeader` default filter and the
  gateway's OpenAPI metadata.
- `GatewayRoutingIntegrationTest` — boots the gateway with a stub backend advertised through
  `SimpleDiscoveryClient` and verifies real forwarding: context path and query string are
  preserved, the original `Host` reaches the backend, unknown paths return `404`, and the
  aggregated Swagger UI, `/v3/api-docs`, `/v3/api-docs/swagger-config` and actuator
  endpoints are served.
- `GatewaySecurityIntegrationTest` — verifies OAuth2 JWT authentication and RBAC authorization
  rules: public endpoints are accessible without credentials, unauthenticated or invalid
  token requests return `401 Unauthorized`, restricted actions (DELETE, runtime route
  management) reject non-admins with `403 Forbidden`, and valid tokens are authenticated
  and routed.


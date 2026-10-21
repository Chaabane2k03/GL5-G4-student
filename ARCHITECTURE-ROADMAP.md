# Microservices and DevOps Architecture Roadmap

This document is a discussion proposal for the GL5-G4 Student Management Platform.
It is intentionally scoped for a university project: the goal is to demonstrate
good architecture, resilience, automation, and observability without introducing
production-scale infrastructure that the team cannot explain or maintain.

## 1. Executive recommendation

Do **not** put a queue between the application services and Prometheus/Grafana.
Prometheus scrapes metrics, Grafana queries observability data, and neither is in
the synchronous business-request path:

```text
Client -> API Gateway -> business service -> MySQL
                              |
                              +-> Prometheus scrapes metrics
                              +-> Alloy/Loki receives logs
                              +-> Jaeger receives traces
```

A queue is useful for asynchronous business work, not as a general solution for
overloaded HTTP services. For this project, the recommended order is:

1. Protect the API Gateway with rate limiting, timeouts, circuit breakers, and
   bounded concurrency.
2. Bound service thread pools, HTTP clients, and database connection pools.
3. Measure behavior with a small load test and use the metrics to find the
   bottleneck.
4. Add replicas only after the application is safe to scale horizontally.
5. Add RabbitMQ for one demonstrable asynchronous workflow, such as notifications
   or audit events.
6. Keep Kafka, Kubernetes, service mesh, and multi-node observability as optional
   stretch goals, not prerequisites.

## 2. What the repository already provides

| Area | Current foundation | Assessment |
| --- | --- | --- |
| API entry point | Spring Cloud API Gateway with Eureka `lb://` routes | Good foundation |
| Service discovery | Eureka server and Eureka clients | Appropriate for the project |
| Configuration | Config Server backed by a private Git repository; encrypted values | Good, but secrets need stricter handling |
| Service isolation | Separate Spring Boot services and one MySQL database per service | Good microservice boundary for the domain |
| Local deployment | Dockerfiles and a full Docker Compose stack | Good developer/demo environment |
| Health checks | Compose health checks and Actuator endpoints | Useful; should be standardized across all services |
| Metrics | Micrometer Prometheus endpoints and a Prometheus server | Already present |
| Dashboards | Grafana provisioning and a Spring services dashboard | Already present |
| Logs | Grafana Alloy forwarding Docker logs to Loki | Already present |
| Traces | OTLP export to Jaeger | Already present |
| CI | GitHub Actions for enrollment and Jenkinsfiles for services | Present, but not yet consistent across every service |
| Quality | Maven tests, JaCoCo, and SonarQube stages in Jenkins | Strong foundation |
| Infrastructure as code | Terraform is referenced in the project layout | Needs an explicit, reproducible scope and documentation |

The existing API Gateway dependencies already include Resilience4j and an
in-memory Bucket4j/Caffeine rate limiter. This means the first resilience phase
should focus on configuration, tests, and demonstration rather than immediately
adding Redis.

## 3. Proposed target architecture

```text
                             +----------------------+
                             |   Developer / User   |
                             +----------+-----------+
                                        |
                              HTTP / OpenAPI
                                        |
                             +----------v-----------+
                             |     API Gateway      |
                             | auth, routing, rate  |
                             | limit, timeout, CB   |
                             +----+----+----+--------+
                                  |    |    |
                         Eureka service discovery
                                  |    |    |
            +---------------------+    |    +---------------------+
            |                          |                          |
   +--------v--------+       +---------v-------+        +---------v-------+
   | Student Service |       | Course Service   |        | Enrollment      |
   |                  |       |                 |        | Service         |
   +--------+---------+       +---------+-------+        +---------+-------+
            |                           |                          |
       Student DB                  Course DB                 Enrollment DB
            |                           |                          |
            +---------------------------+--------------------------+
                                        |
                              Optional transactional outbox
                                        |
                              +---------v----------+
                              | RabbitMQ (optional)|
                              +----+---------+-----+
                                   |         |
                            notification   audit/report
                             consumer       consumer

  All services -> Actuator/Micrometer -> Prometheus -> Grafana
  All services -> structured logs -> Alloy -> Loki -> Grafana
  All services -> OTLP traces -> Jaeger -> Grafana/Jaeger UI
```

The Config Server and Eureka Server remain platform services. They should be
started before the business services, but business services should fail clearly
when they cannot obtain required configuration or register with Eureka.

## 4. Resilience strategy for many requests

### 4.1 API Gateway: the first protection layer

Configure and test the existing gateway resilience features:

- Rate limit by client identity where available, otherwise by IP for the demo.
- Return `429 Too Many Requests` when the limit is exceeded.
- Set a finite timeout for calls to each backend.
- Add a circuit breaker and a clear fallback response for unavailable services.
- Limit concurrent calls to a slow backend so it cannot consume all gateway
  resources.
- Reject oversized request bodies.
- Do not expose direct service ports to users in the preferred deployment path.

The in-memory rate limiter is acceptable for a single gateway container and a
university demonstration. It is not globally consistent across multiple gateway
replicas. If the team demonstrates multiple gateway replicas, either document
that limitation or use a shared store such as Redis.

### 4.2 Business services: bounded resources

Each service should have explicit, documented limits for:

- HTTP worker threads or reactive concurrency.
- Outbound HTTP connection count and timeout.
- HikariCP maximum database connections.
- Request timeout and transaction timeout.
- Maximum queue length for any local executor.
- JVM heap and container memory.

Increasing thread counts without checking MySQL capacity can make an overload
worse. The dashboard should show active/pending database connections and request
latency so the team can explain the chosen values.

### 4.3 Database behavior

For a university project, the important practices are:

- Keep one database per service and avoid cross-service SQL joins.
- Use indexes for fields used in lookup and enrollment validation.
- Detect and document slow queries.
- Configure a bounded connection pool.
- Add backup/restore instructions for the demo database volumes.
- Use migrations (Flyway or Liquibase) if schema changes are expected.

## 5. Where a queue does make sense

Add RabbitMQ only for work that does not need to finish before the HTTP response.
A good demonstration is:

```text
POST /enrollment
  -> validate student/course synchronously
  -> save enrollment
  -> publish EnrollmentCreated
  -> return success

EnrollmentCreated
  -> audit consumer
  -> notification consumer
```

For reliable delivery, use a small transactional outbox:

```text
same database transaction:
  enrollment row + outbox row

publisher:
  read unpublished outbox rows
  publish to RabbitMQ
  mark the row published
```

Consumers should be idempotent because messages can be delivered more than once.
The project should show retry behavior and a dead-letter queue for messages that
cannot be processed.

Do not use a queue to hide a slow synchronous database request, and do not make
basic CRUD operations asynchronous unless the API contract explicitly explains
that the result is eventually consistent.

## 6. DevOps capabilities to add

### Priority 1: complete the baseline

- Standardize the same build, test, Docker build, and health-check stages for all
  five Spring applications.
- Use one documented CI convention: GitHub Actions, Jenkins, or both with clear
  responsibilities.
- Add pull-request checks for compilation, unit tests, integration tests, code
  coverage, and static analysis.
- Publish versioned Docker images using the commit SHA, not only `latest`.
- Scan Docker images and dependencies for known vulnerabilities.
- Add a non-secret `.env.example`; never commit tokens, passwords, or encryption
  keys.
- Add a Compose validation command and a smoke-test script that checks gateway
  routing and all health endpoints.

### Priority 2: make deployments repeatable

- Separate local development, CI, and demo deployment Compose files.
- Add explicit resource limits and health checks to application containers.
- Add a deployment script with `up`, `down`, `logs`, `health`, and `smoke-test`
  commands.
- Document rollback to a previous image tag.
- Define how configuration changes are reviewed and rolled back.
- Keep database data volumes separate from disposable application containers.

### Priority 3: observability and operations

- Add Grafana alerts for error rate, latency, unavailable instances, JVM memory,
  database pool exhaustion, and message backlog.
- Add correlation IDs to logs and propagate them across gateway and services.
- Use consistent metric names and avoid high-cardinality labels such as user IDs
  and full request URLs.
- Configure retention limits for Prometheus, Loki, and Jaeger.
- Reduce trace sampling from 100% when running a load test.
- Add a short runbook for common failures: Config Server unavailable, Eureka
  registration failure, database unavailable, and queue consumer failure.

### Priority 4: optional platform deployment

If the course requires a cloud or orchestration demonstration, choose **one**
platform path rather than implementing all of them:

- Kubernetes manifests or Helm chart for the services, or
- Terraform for a small cloud environment, or
- A VM-based Docker Compose deployment.

Kubernetes should be presented as a deployment option, not as a requirement for
proving microservice concepts. If Kubernetes is selected, demonstrate Deployments,
Services, ConfigMaps, Secrets, readiness/liveness probes, and horizontal scaling.

## 7. Security baseline

For the university scope, the team should be able to demonstrate:

- Authentication and authorization at the gateway or service boundary.
- Separate credentials for local, CI, and demo environments.
- No secrets in Git history, Docker images, or logs.
- Restricted Actuator endpoints; expose only what monitoring needs.
- HTTPS/TLS in the chosen deployment environment, or explicitly document that
  local Compose uses HTTP only.
- Input validation and consistent error responses.
- Database users with only the permissions their service needs.
- Dependency and container image scanning in CI.
- Rotating the sample credentials before any public demo.

The currently documented `admin/admin` Grafana credentials are suitable only for
local development and should not be reused in a shared environment.

## 8. Testing and demonstration plan

The project will be easier to evaluate if each architectural claim has a small
repeatable demonstration:

| Claim | Demonstration |
| --- | --- |
| Gateway routing works | Call each API through the gateway and verify the target service |
| Rate limiting works | Send a burst of requests and observe `429` responses |
| Circuit breaker works | Stop one service and observe a fast, controlled gateway response |
| Service discovery works | Restart a service and verify Eureka registration and routing |
| Observability works | Create a request and follow its metrics, logs, and trace |
| CI works | Open a pull request and show tests, coverage, analysis, and image build |
| Queue works | Create an enrollment and show an event consumed by audit/notification |
| Recovery works | Restart a database/service and show health checks and recovery |
| Scaling works | Run two instances of one stateless service and show load distribution |

For load testing, use a small tool such as k6, JMeter, or Gatling. Measure
throughput, p95 latency, error rate, and resource usage. Do not claim that the
system is resilient merely because it survives one manual request.

## 9. Suggested implementation backlog

### Must have

- [ ] Standardize CI for all services.
- [ ] Verify and test gateway rate limiting, timeouts, and circuit breakers.
- [ ] Add bounded connection-pool and request settings.
- [ ] Add consistent health/readiness checks.
- [ ] Add a smoke-test and a small load-test scenario.
- [ ] Add Grafana alerts and retention settings.
- [ ] Remove default credentials from shared/demo deployment documentation.
- [ ] Document secrets, backup, rollback, and incident procedures.

### Should have

- [ ] Add correlation IDs and structured business-event logging.
- [ ] Add Flyway or Liquibase migrations.
- [ ] Add dependency and Docker image vulnerability scans.
- [ ] Add RabbitMQ for one asynchronous workflow.
- [ ] Add an outbox and idempotent consumer for that workflow.
- [ ] Add a deployment target: Kubernetes, Terraform-backed environment, or VM.

### Stretch goals

- [ ] Redis-backed distributed rate limiting.
- [ ] Kafka instead of RabbitMQ, with a clear justification.
- [ ] Horizontal autoscaling.
- [ ] Managed Prometheus/Loki/Jaeger or long-term remote storage.
- [ ] Service mesh, canary deployment, and multi-region design.

## 10. Decisions for the team meeting

The team should decide:

1. Which asynchronous use case will justify RabbitMQ?
2. Will CI use Jenkins, GitHub Actions, or a documented combination?
3. Is the final demonstration local Compose, Kubernetes, Terraform/cloud, or a
   comparison of two deployment modes?
4. What request rate and p95 latency target will be tested?
5. Which service will be scaled horizontally for the demonstration?
6. Which authentication model is in scope?
7. Who owns dashboards, alerts, deployment scripts, security, and the runbook?

The recommended project boundary is a reliable, observable Compose deployment
with one well-designed asynchronous workflow. That demonstrates the architecture
clearly while keeping the implementation explainable and achievable.

# Eureka Integration Test

## Purpose

`EurekaServerIntegrationTest` verifies the lifecycle of a temporary Eureka
client without importing or modifying any of the project services:

- `student-service`
- `department-service`
- `enrollment-service`

The temporary client is created only for the test and runs in a Testcontainers
container.

## What the test verifies

The test is located at:

`src/test/java/tn/fst/eureka/EurekaServerIntegrationTest.java`

It verifies the following sequence:

1. Eureka starts on a random local port.
2. The Eureka registry endpoint responds successfully.
3. A temporary Spring Boot Eureka client starts in a container.
4. The client registers itself with Eureka.
5. The client can be discovered through:

   ```text
   /eureka/apps/{applicationName}
   ```

6. The client container stops without explicitly unregistering.
7. Eureka eventually removes the client after its lease expires.

The test uses Awaitility polling because registration, heartbeats, lease
expiration, and registry eviction are asynchronous operations.

## Test data

The test does not use static registrations or data imported from other
microservices. Each execution generates a unique application name:

```text
TEMP-CLIENT-{random UUID}
```

The temporary client configuration and source code are stored under:

```text
src/test/resources/temporary-client/
```

These files are copied into the temporary container at runtime. They are not
part of the production Eureka server application.

## Temporary client configuration

The client uses the following test-only settings:

```properties
eureka.client.register-with-eureka=true
eureka.client.fetch-registry=true
eureka.client.should-unregister-on-shutdown=false
eureka.instance.lease-renewal-interval-in-seconds=1
eureka.instance.lease-expiration-duration-in-seconds=3
```

The short lease values make the expiration scenario practical during testing.
The Eureka server also disables self-preservation and uses a short eviction
interval for this test:

```properties
eureka.server.enable-self-preservation=false
eureka.server.eviction-interval-timer-in-ms=1000
```

These values apply only to the test application context and do not change the
production `application.yml`.

## Prerequisites

Install and make the following tools available:

- Java 17 or newer
- Maven
- Docker Desktop with the Docker daemon running

Testcontainers requires a working Docker daemon. Verify it from PowerShell:

```powershell
docker info
```

If Docker is stopped, the test fails before the temporary client can start.

## Run the test

From the repository root:

```powershell
mvn -f .\eureka-server\pom.xml -Dtest=EurekaServerIntegrationTest test
```

Run the complete Eureka server build:

```powershell
mvn -f .\eureka-server\pom.xml clean package
```

The test may take a few minutes on a cold Docker/Maven cache because it starts
Maven inside a container and waits for the Eureka lease to expire after the
client is stopped. Container startup allows up to two minutes for dependency
resolution; registration and lease expiration each have separate 45-second
polling windows.

## Test execution flow

The test starts the Eureka server through `@SpringBootTest`:

```java
@SpringBootTest(
        classes = EurekaServerApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
```

It then starts a temporary container using the image:

```text
maven:3.9-eclipse-temurin-17
```

The container copies in the temporary client's Maven project and starts it
with:

```text
mvn -q --define spring-boot.run.fork=false spring-boot:run
```

Testcontainers overrides the image command, so the Maven executable is passed
explicitly. The long-form `--define` option avoids Docker Desktop argument
parsing issues with Maven's short `-Dkey=value` form on Windows.

Container readiness is based on the client listening on port `8080`. Eureka
registration itself is verified separately by polling the registry response.

After registration is confirmed, the test stops the container and waits for
the application to disappear from Eureka. It does not expect immediate
removal.

## Expected result

A successful run reports:

```text
Tests run: 1, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

## Troubleshooting

### Docker daemon unavailable

Start Docker Desktop and verify:

```powershell
docker info
```

Then rerun the Maven test command.

### Container startup timeout

Inspect the container output and confirm that:

- Maven can download dependencies.
- The temporary client compiles.
- Port `8080` is available inside the container.
- The container can reach the host Eureka server through
  `host.testcontainers.internal`.

### Registration timeout

Confirm that the Eureka server is reachable from the container and that the
temporary client has:

```properties
eureka.client.register-with-eureka=true
eureka.client.service-url.defaultZone=${EUREKA_URL}
```

### Expiration timeout

Eureka eviction is asynchronous. The test already allows a 45-second polling
window. Check that:

- `eureka.client.should-unregister-on-shutdown=false`
- the temporary client is actually stopped
- server self-preservation is disabled for the test
- the server eviction interval is configured

## Scope

This test is intentionally limited to Eureka registration, discovery, and
lease expiration. It does not test business logic or the integration of the
student, department, and enrollment services. Those services can continue to
be developed and tested independently.

package tn.fst.eureka;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import java.time.Duration;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.MediaType;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.utility.MountableFile;

@SpringBootTest(
        classes = EurekaServerApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
                "eureka.server.eviction-interval-timer-in-ms=1000",
                "eureka.server.enable-self-preservation=false",
                "eureka.client.register-with-eureka=false",
                "eureka.client.fetch-registry=false"
        })
class EurekaServerIntegrationTest {

    private static final Duration REGISTRATION_TIMEOUT = Duration.ofSeconds(45);
    private static final Duration EXPIRATION_TIMEOUT = Duration.ofSeconds(45);
    private static final Duration CONTAINER_STARTUP_TIMEOUT = Duration.ofSeconds(120);

    @LocalServerPort
    private int serverPort;

    @Test
    void registersTemporaryContainerClientAndExpiresItsLeaseAfterStop() {
        RestClient restClient = RestClient.builder()
                .baseUrl("http://localhost:" + serverPort)
                .defaultHeader("Accept", MediaType.APPLICATION_JSON_VALUE)
                .build();

        assertThat(restClient.get()
                .uri("/eureka/apps")
                .retrieve()
                .toBodilessEntity()
                .getStatusCode()
                .is2xxSuccessful()).isTrue();

        String applicationName = "TEMP-CLIENT-" + UUID.randomUUID().toString().replace("-", "").toUpperCase();
        String eurekaUrl = "http://host.testcontainers.internal:" + serverPort + "/eureka/";

        try (GenericContainer<?> client = temporaryClientContainer(applicationName, eurekaUrl)) {
            client.start();

            await().atMost(REGISTRATION_TIMEOUT)
                    .pollInterval(Duration.ofMillis(500))
                    .untilAsserted(() -> assertThat(discoveredApplication(restClient, applicationName))
                            .contains(applicationName));

            client.stop();
        }

        await().atMost(EXPIRATION_TIMEOUT)
                .pollInterval(Duration.ofMillis(500))
                .untilAsserted(() -> assertThat(discoveredApplication(restClient, applicationName)).isEmpty());
    }

    private GenericContainer<?> temporaryClientContainer(String applicationName, String eurekaUrl) {
        return new GenericContainer<>("maven:3.9-eclipse-temurin-17")
                .withCopyToContainer(
                        MountableFile.forClasspathResource("temporary-client/pom.xml"),
                        "/temporary-client/pom.xml")
                .withCopyToContainer(
                        MountableFile.forClasspathResource("temporary-client/src"),
                        "/temporary-client/src")
                .withEnv("CLIENT_NAME", applicationName)
                .withEnv("EUREKA_URL", eurekaUrl)
                .withExtraHost("host.testcontainers.internal", "host-gateway")
                .withExposedPorts(8080)
                .withWorkingDirectory("/temporary-client")
                .withCommand("mvn", "-q", "--define", "spring-boot.run.fork=false", "spring-boot:run")
                .waitingFor(Wait.forListeningPort())
                .withStartupTimeout(CONTAINER_STARTUP_TIMEOUT);
    }

    private String discoveredApplication(RestClient restClient, String applicationName) {
        try {
            String response = restClient.get()
                    .uri("/eureka/apps/" + applicationName)
                    .retrieve()
                    .body(String.class);
            return response == null ? "" : response;
        } catch (HttpClientErrorException.NotFound ignored) {
            return "";
        }
    }
}

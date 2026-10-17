package tn.fst.apigateway;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.reactive.AutoConfigureWebTestClient;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.reactive.server.WebTestClient;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Starts the gateway on a random port with a real HTTP stub standing in for the
 * backend services, then checks that requests are actually forwarded: the context
 * path is preserved, the original Host header reaches the backend
 * ({@code PreserveHostHeader}), unknown paths return 404, and the aggregated
 * Swagger UI, gateway OpenAPI document and actuator endpoints are exposed.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureWebTestClient
@ActiveProfiles("test")
@org.springframework.context.annotation.Import(TestSecurityConfig.class)
class GatewayRoutingIntegrationTest {

    private static final List<String> SERVICE_IDS = List.of(
            "department-service", "course-service", "enrollment-service", "student-service");

    private static final List<String> SERVICE_CONTEXT_PATHS =
            List.of("/department", "/course", "/enrollment", "/student");
    private static final List<String> SWAGGER_SERVICE_NAMES =
            List.of("Course Service", "Department Service", "Enrollment Service", "Student Service");

    private static final StubBackend BACKEND = StubBackend.start();

    /**
     * Keeps the real {@code lb://<service-id>} routes but makes them resolvable
     * without Eureka: SimpleDiscoveryClient advertises the stub backend as the
     * single instance of every service.
     */
    @DynamicPropertySource
    static void advertiseTheStubBackendForEveryService(DynamicPropertyRegistry registry) {
        for (String serviceId : SERVICE_IDS) {
            registry.add("spring.cloud.discovery.client.simple.instances." + serviceId + "[0].uri", BACKEND::uri);
        }
    }

    @AfterAll
    static void stopBackend() {
        BACKEND.stop();
    }

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private WebTestClient webTestClient;

    @LocalServerPort
    private int gatewayPort;

    @org.junit.jupiter.api.BeforeEach
    void setUpAuth() {
        if (restTemplate.getRestTemplate().getInterceptors().isEmpty()) {
            restTemplate.getRestTemplate().getInterceptors().add((request, body, execution) -> {
                request.getHeaders().setBearerAuth(TestSecurityConfig.ADMIN_TOKEN);
                return execution.execute(request, body);
            });
        }
    }

    @Test
    void forwardsDepartmentRequestsToTheBackendWithThePathPreserved() {
        ResponseEntity<String> response = restTemplate.getForEntity("/department/api/departments", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("\"path\":\"/department/api/departments\"");
        assertThat(BACKEND.lastPath()).isEqualTo("/department/api/departments");
    }

    @Test
    void routesEveryServiceContextPathToTheBackend() {
        for (String contextPath : SERVICE_CONTEXT_PATHS) {
            BACKEND.reset();

            ResponseEntity<String> response =
                    restTemplate.getForEntity(contextPath + "/actuator/health", String.class);

            assertThat(response.getStatusCode()).as(contextPath).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody()).contains("\"path\":\"" + contextPath + "/actuator/health\"");
            assertThat(BACKEND.lastPath()).isEqualTo(contextPath + "/actuator/health");
        }
    }

    @Test
    void preservesTheQueryStringWhenForwarding() {
        ResponseEntity<String> response =
                restTemplate.getForEntity("/course/api/courses?page=1&size=5", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("\"path\":\"/course/api/courses?page=1&size=5\"");
    }

    @Test
    void preservesTheOriginalHostHeaderForTheBackend() {
        BACKEND.reset();

        ResponseEntity<String> response =
                restTemplate.getForEntity("/student/students/getAllStudents", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(BACKEND.lastHost()).isEqualTo("localhost:" + gatewayPort);
    }

    @Test
    void returnsNotFoundForAnUnmappedPath() {
        webTestClient.get().uri("/unknown/whatever")
                .headers(h -> h.setBearerAuth(TestSecurityConfig.ADMIN_TOKEN))
                .exchange()
                .expectStatus().isNotFound();
    }

    @Test
    void servesTheAggregatedSwaggerUi() {
        webTestClient.get().uri("/swagger-ui.html")
                .exchange()
                .expectStatus().is3xxRedirection()
                .expectHeader().valueEquals("Location", "/swagger-ui/index.html");

        webTestClient.get().uri("/swagger-ui/index.html")
                .exchange()
                .expectStatus().isOk()
                .expectHeader().contentTypeCompatibleWith("text/html");
    }

    @Test
    void publishesItsOwnOpenApiDocument() {
        webTestClient.get().uri("/v3/api-docs")
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.info.title").isEqualTo("API Gateway")
                .jsonPath("$.info.version").isEqualTo("v1");
    }

    @Test
    void listsEveryBackendServiceInTheSwaggerConfiguration() {
        webTestClient.get().uri("/v3/api-docs/swagger-config")
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.urls[0].name").isEqualTo(SWAGGER_SERVICE_NAMES.get(0))
                .jsonPath("$.urls[0].url").isEqualTo("/course/v3/api-docs")
                .jsonPath("$.urls[1].name").isEqualTo(SWAGGER_SERVICE_NAMES.get(1))
                .jsonPath("$.urls[1].url").isEqualTo("/department/v3/api-docs")
                .jsonPath("$.urls[2].name").isEqualTo(SWAGGER_SERVICE_NAMES.get(2))
                .jsonPath("$.urls[2].url").isEqualTo("/enrollment/v3/api-docs")
                .jsonPath("$.urls[3].name").isEqualTo(SWAGGER_SERVICE_NAMES.get(3))
                .jsonPath("$.urls[3].url").isEqualTo("/student/v3/api-docs")
                .jsonPath("$.tagsSorter").isEqualTo("alpha")
                .jsonPath("$.operationsSorter").isEqualTo("alpha")
                .jsonPath("$.docExpansion").isEqualTo("none");
    }

    @Test
    void exposesHealthAndGatewayRoutesThroughActuator() {
        webTestClient.get().uri("/actuator/health")
                .exchange()
                .expectStatus().isOk()
                .expectBody().jsonPath("$.status").isEqualTo("UP");

        webTestClient.get().uri("/actuator/gateway/routes")
                .headers(h -> h.setBearerAuth(TestSecurityConfig.ADMIN_TOKEN))
                .exchange()
                .expectStatus().isOk()
                .expectBody(String.class)
                .value(body -> assertThat(body).contains("department-service", "course-service",
                        "enrollment-service", "student-service", "PreserveHostHeader"));
    }

    /**
     * Minimal HTTP server that records the last request it received and echoes it
     * back as JSON, so tests can assert how the gateway forwarded the request.
     */
    static final class StubBackend {

        private final HttpServer server;
        private final List<String> paths = new CopyOnWriteArrayList<>();
        private final List<String> hosts = new CopyOnWriteArrayList<>();

        private StubBackend() throws IOException {
            this.server = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
            this.server.createContext("/", exchange -> {
                paths.add(exchange.getRequestURI().toString());
                hosts.add(exchange.getRequestHeaders().getFirst("Host"));

                String body = "{\"method\":\"" + exchange.getRequestMethod()
                        + "\",\"path\":\"" + exchange.getRequestURI()
                        + "\",\"host\":\"" + exchange.getRequestHeaders().getFirst("Host") + "\"}";
                byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().add("Content-Type", "application/json");
                exchange.sendResponseHeaders(200, bytes.length);
                try (OutputStream out = exchange.getResponseBody()) {
                    out.write(bytes);
                }
            });
            this.server.start();
        }

        static StubBackend start() {
            try {
                return new StubBackend();
            } catch (IOException e) {
                throw new IllegalStateException("Unable to start the stub backend", e);
            }
        }

        String uri() {
            return "http://localhost:" + server.getAddress().getPort();
        }

        void reset() {
            paths.clear();
            hosts.clear();
        }

        String lastPath() {
            return paths.isEmpty() ? null : paths.get(paths.size() - 1);
        }

        String lastHost() {
            return hosts.isEmpty() ? null : hosts.get(hosts.size() - 1);
        }

        void stop() {
            server.stop(0);
        }
    }
}

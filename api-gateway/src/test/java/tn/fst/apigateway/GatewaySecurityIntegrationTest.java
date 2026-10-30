package tn.fst.apigateway;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.reactive.AutoConfigureWebTestClient;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpMethod;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.reactive.server.WebTestClient;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;

/**
 * Validates OAuth2 authentication, Audience validation, and fine-grained RBAC authorization:
 * 1. Audience (aud) validation prevents cross-client token reuse.
 * 2. Client role isolation ensures roles in unrelated clients do not grant access on this gateway.
 * 3. CORS preflight (OPTIONS) requests pass without tokens.
 * 4. Fine-grained RBAC matrix:
 *    - Department: POST/PUT/DELETE restricted to ADMIN; GET authenticated.
 *    - Course: POST/PUT allowed for ADMIN and TEACHER; DELETE restricted to ADMIN; GET authenticated.
 *    - Enrollment: POST allowed for STUDENT and ADMIN; PUT/DELETE restricted to ADMIN.
 *    - Student: POST restricted to ADMIN; PUT allowed for STUDENT and ADMIN.
 * 5. Public health probe is always accessible.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureWebTestClient
@ActiveProfiles("test")
@Import(TestSecurityConfig.class)
class GatewaySecurityIntegrationTest {

    private static final List<String> SERVICE_IDS = List.of(
            "department-service", "course-service", "enrollment-service", "student-service");

    private static final StubServer STUB = StubServer.start();

    @DynamicPropertySource
    static void configureStub(DynamicPropertyRegistry registry) {
        for (String id : SERVICE_IDS) {
            registry.add("spring.cloud.discovery.client.simple.instances." + id + "[0].uri", STUB::uri);
        }
    }

    @AfterAll
    static void tearDown() {
        STUB.stop();
    }

    @Autowired
    private WebTestClient webTestClient;

    @LocalServerPort
    private int port;

    @BeforeEach
    void setUp() {
        this.webTestClient = webTestClient.mutate()
                .defaultHeader("Host", "localhost:" + port)
                .build();
    }

    // --- 1. Basic Authentication & Audience Validation ---

    @Test
    void unauthenticatedRequestToBackendServiceReturns401() {
        webTestClient.get().uri("/course/api/courses")
                .exchange()
                .expectStatus().isUnauthorized();
    }

    @Test
    void invalidTokenReturns401() {
        webTestClient.get().uri("/department/api/departments")
                .headers(h -> h.setBearerAuth(TestSecurityConfig.INVALID_TOKEN))
                .exchange()
                .expectStatus().isUnauthorized();
    }

    @Test
    void tokenWithWrongAudienceIsRejectedWith401() {
        webTestClient.get().uri("/course/api/courses")
                .headers(h -> h.setBearerAuth(TestSecurityConfig.WRONG_AUDIENCE_TOKEN))
                .exchange()
                .expectStatus().isUnauthorized();
    }

    @Test
    void validTokenWithCorrectAudienceAuthenticatesAndRoutes() {
        webTestClient.get().uri("/course/api/courses")
                .headers(h -> h.setBearerAuth(TestSecurityConfig.REGULAR_USER_TOKEN))
                .exchange()
                .expectStatus().isOk()
                .expectBody().jsonPath("$.path").isEqualTo("/course/api/courses");
    }

    // --- 2. Client Role Isolation (Unrelated client roles do not grant gateway admin) ---

    @Test
    void unrelatedClientRoleDoesNotGrantAdminPrivilegesOnGateway() {
        // User has "admin" in "other-service", but NOT in "api-gateway"
        webTestClient.get().uri("/actuator/gateway/routes")
                .headers(h -> h.setBearerAuth(TestSecurityConfig.UNRELATED_CLIENT_ADMIN_TOKEN))
                .exchange()
                .expectStatus().isForbidden();
    }

    // --- 3. CORS Preflight Handling ---

    @Test
    void corsPreflightOptionsRequestPassesWithoutToken() {
        webTestClient.method(HttpMethod.OPTIONS).uri("http://localhost:" + port + "/course/api/courses")
                .header("Origin", "http://localhost:3000")
                .header("Access-Control-Request-Method", "POST")
                .exchange()
                .expectStatus().isOk();
    }

    // --- 4. Fine-Grained Role Matrix Tests ---

    @Test
    void studentCannotCreateCourse() {
        webTestClient.post().uri("/course/api/courses")
                .headers(h -> h.setBearerAuth(TestSecurityConfig.STUDENT_TOKEN))
                .exchange()
                .expectStatus().isForbidden();
    }

    @Test
    void teacherCanCreateCourse() {
        webTestClient.post().uri("/course/api/courses")
                .headers(h -> h.setBearerAuth(TestSecurityConfig.TEACHER_TOKEN))
                .exchange()
                .expectStatus().isOk()
                .expectBody().jsonPath("$.method").isEqualTo("POST");
    }

    @Test
    void teacherCannotCreateDepartment() {
        webTestClient.post().uri("/department/api/departments")
                .headers(h -> h.setBearerAuth(TestSecurityConfig.TEACHER_TOKEN))
                .exchange()
                .expectStatus().isForbidden();
    }

    @Test
    void adminCanCreateDepartment() {
        webTestClient.post().uri("/department/api/departments")
                .headers(h -> h.setBearerAuth(TestSecurityConfig.ADMIN_TOKEN))
                .exchange()
                .expectStatus().isOk()
                .expectBody().jsonPath("$.method").isEqualTo("POST");
    }

    @Test
    void studentCanCreateEnrollment() {
        webTestClient.post().uri("/enrollment/api/enrollments")
                .headers(h -> h.setBearerAuth(TestSecurityConfig.STUDENT_TOKEN))
                .exchange()
                .expectStatus().isOk()
                .expectBody().jsonPath("$.method").isEqualTo("POST");
    }

    @Test
    void studentCannotRegisterStudent() {
        webTestClient.post().uri("/student/api/students")
                .headers(h -> h.setBearerAuth(TestSecurityConfig.STUDENT_TOKEN))
                .exchange()
                .expectStatus().isForbidden();
    }

    @Test
    void adminCanRegisterStudent() {
        webTestClient.post().uri("/student/api/students")
                .headers(h -> h.setBearerAuth(TestSecurityConfig.ADMIN_TOKEN))
                .exchange()
                .expectStatus().isOk()
                .expectBody().jsonPath("$.method").isEqualTo("POST");
    }

    @Test
    void teacherCannotDeleteCourse() {
        webTestClient.delete().uri("/course/api/courses/101")
                .headers(h -> h.setBearerAuth(TestSecurityConfig.TEACHER_TOKEN))
                .exchange()
                .expectStatus().isForbidden();
    }

    @Test
    void adminCanDeleteCourse() {
        webTestClient.delete().uri("/course/api/courses/101")
                .headers(h -> h.setBearerAuth(TestSecurityConfig.ADMIN_TOKEN))
                .exchange()
                .expectStatus().isOk()
                .expectBody().jsonPath("$.method").isEqualTo("DELETE");
    }

    // --- 5. Public Documentation and Actuator Probes ---

    @Test
    void publicHealthProbeAccessibleWithoutToken() {
        webTestClient.get().uri("/actuator/health")
                .exchange()
                .expectStatus().isOk()
                .expectBody().jsonPath("$.status").isEqualTo("UP");
    }

    @Test
    void publicSwaggerUiAccessibleWithoutTokenInDevProfile() {
        webTestClient.get().uri("/swagger-ui/index.html")
                .exchange()
                .expectStatus().isOk();

        webTestClient.get().uri("/v3/api-docs")
                .exchange()
                .expectStatus().isOk();
    }

    static final class StubServer {
        private final HttpServer server;

        private StubServer() throws IOException {
            this.server = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
            this.server.createContext("/", exchange -> {
                String body = "{\"status\":\"ok\",\"method\":\"" + exchange.getRequestMethod()
                        + "\",\"path\":\"" + exchange.getRequestURI() + "\"}";
                byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().add("Content-Type", "application/json");
                exchange.sendResponseHeaders(200, bytes.length);
                try (OutputStream out = exchange.getResponseBody()) {
                    out.write(bytes);
                }
            });
            this.server.start();
        }

        static StubServer start() {
            try {
                return new StubServer();
            } catch (IOException e) {
                throw new IllegalStateException("Failed to start stub server", e);
            }
        }

        String uri() {
            return "http://localhost:" + server.getAddress().getPort();
        }

        void stop() {
            server.stop(0);
        }
    }
}

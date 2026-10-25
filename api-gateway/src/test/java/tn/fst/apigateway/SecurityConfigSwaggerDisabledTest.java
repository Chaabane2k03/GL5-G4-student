package tn.fst.apigateway;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.reactive.AutoConfigureWebTestClient;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.reactive.server.WebTestClient;

/**
 * Covers the production toggle that hides Swagger/OpenAPI behind ADMIN: with
 * {@code gateway.security.swagger-public=false} the documentation endpoints are no
 * longer public, so an anonymous call must be rejected instead of served.
 */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = "gateway.security.swagger-public=false")
@AutoConfigureWebTestClient
@ActiveProfiles("test")
@Import(TestSecurityConfig.class)
class SecurityConfigSwaggerDisabledTest {

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

    @Test
    void swaggerDocumentationRequiresAuthenticationWhenNotPublic() {
        webTestClient.get().uri("/v3/api-docs")
                .exchange()
                .expectStatus().isUnauthorized();

        webTestClient.get().uri("/swagger-ui/index.html")
                .exchange()
                .expectStatus().isUnauthorized();
    }

    @Test
    void actuatorHealthStaysPublic() {
        webTestClient.get().uri("/actuator/health")
                .exchange()
                .expectStatus().isOk();
    }
}

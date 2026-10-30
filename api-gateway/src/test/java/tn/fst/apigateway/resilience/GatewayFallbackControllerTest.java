package tn.fst.apigateway.resilience;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.net.URI;
import java.security.Principal;

import static org.assertj.core.api.Assertions.assertThat;

class GatewayFallbackControllerTest {

    private final GatewayFallbackController controller = new GatewayFallbackController();

    @Test
    void anonymousCallerGetsAProblemDetailWithoutIdentity() {
        MockServerWebExchange exchange = MockServerWebExchange.from(
                MockServerHttpRequest.get("/fallback/course-service").build());

        ResponseEntity<ProblemDetail> response = controller.fallback("course-service", exchange).block();

        assertThat(response).isNotNull();
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(response.getHeaders().getFirst(HttpHeaders.RETRY_AFTER)).isEqualTo("10");

        ProblemDetail body = response.getBody();
        assertThat(body).isNotNull();
        assertThat(body.getStatus()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE.value());
        assertThat(body.getTitle()).isEqualTo("Service Unavailable");
        assertThat(body.getDetail()).contains("course-service");
        assertThat(body.getInstance()).isEqualTo(URI.create("/fallback/course-service"));
        assertThat(body.getProperties())
                .containsEntry("service", "course-service")
                .doesNotContainKey("caller");
        assertThat(body.getProperties().get("timestamp")).isNotNull();
    }

    @Test
    void authenticatedCallerIsNamedInTheProblemDetail() {
        ServerWebExchange exchange = MockServerWebExchange.from(
                        MockServerHttpRequest.get("/fallback/student-service").build())
                .mutate()
                .principal(Mono.just((Principal) () -> "alice"))
                .build();

        ResponseEntity<ProblemDetail> response = controller.fallback("student-service", exchange).block();

        assertThat(response).isNotNull();
        ProblemDetail body = response.getBody();
        assertThat(body).isNotNull();
        assertThat(body.getProperties())
                .containsEntry("service", "student-service")
                .containsEntry("caller", "alice");
    }
}

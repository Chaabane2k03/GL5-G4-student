package tn.fst.apigateway.resilience;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.reactive.server.WebTestClient;

import java.io.IOException;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pins down what a retry does once a route resolves through the load balancer.
 *
 * <p>This is the one interaction the other resiliency tests structurally cannot see: they
 * point their routes at the stub with a literal {@code http://} URI, so discovery and the
 * load balancer never take part in the exchange.
 *
 * <p>The question is whether the gateway's {@code Retry} filter, on a retry, resolves the
 * service again and can therefore land on a different instance, or whether it re-sends to
 * the address it already chose. The two behave identically while every instance is
 * healthy, and only diverge once one instance is down. That is what makes the difference
 * worth pinning down rather than assuming: with the second behaviour the retry still
 * reports attempts, still logs, and still divides the gateway's effort, but it can never
 * rescue a request from a dead instance.
 *
 * <p>Two instances are advertised under one service id: a stub that always answers 503 and
 * a stub that always answers 200. Two requests are enough, because round robin rotates, so
 * whichever instance the rotation starts on, the failing one is picked at least once
 * across the pair. That also makes the test independent of how far an earlier test
 * advanced the rotation.
 */
@SpringBootTest(classes = ResiliencyTestApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
                "spring.cloud.gateway.server.webflux.routes[0].id=lb-retry-route",
                "spring.cloud.gateway.server.webflux.routes[0].uri=lb://resiliency-lb-retry-backend",
                "spring.cloud.gateway.server.webflux.routes[0].predicates[0]=Path=/lb-retry/**",
                "spring.cloud.gateway.server.webflux.routes[0].filters[0].name=Retry",
                "spring.cloud.gateway.server.webflux.routes[0].filters[0].args.retries=1",
                // Stated explicitly rather than relying on the filter's default
                // "series=SERVER_ERROR": the retry has to fire for this test to mean
                // anything, so the condition that makes it fire is worth being explicit
                // about.
                "spring.cloud.gateway.server.webflux.routes[0].filters[0].args.statuses=SERVICE_UNAVAILABLE",
                "spring.cloud.gateway.server.webflux.routes[0].filters[0].args.methods=GET"})
@ActiveProfiles("resiliency-test")
class LoadBalancerRetryIntegrationTest {

    private static final FailingStubBackend FAILING = startFailingBackend();

    private static final FailingStubBackend HEALTHY = startHealthyBackend();

    /** Answers every request with 503. */
    private static FailingStubBackend startFailingBackend() {
        FailingStubBackend backend = startHealthyBackend();
        backend.failPermanently();
        return backend;
    }

    private static FailingStubBackend startHealthyBackend() {
        try {
            return new FailingStubBackend();
        } catch (IOException e) {
            throw new IllegalStateException("could not start the stub backend", e);
        }
    }

    @DynamicPropertySource
    static void backendInstances(DynamicPropertyRegistry registry) {
        registry.add("spring.cloud.discovery.client.simple.instances."
                + "resiliency-lb-retry-backend[0].uri", FAILING::uri);
        registry.add("spring.cloud.discovery.client.simple.instances."
                + "resiliency-lb-retry-backend[1].uri", HEALTHY::uri);
    }

    @Autowired
    private WebTestClient client;

    @BeforeEach
    void resetRequestCounters() {
        FAILING.resetRequestCount();
        HEALTHY.resetRequestCount();
    }

    @AfterAll
    static void stopBackends() {
        FAILING.close();
        HEALTHY.close();
    }

    @Test
    void retryResolvesTheServiceAgainInsteadOfReusingTheFailedInstance() {
        client.get().uri("/lb-retry/first").exchange().expectStatus().isOk();
        client.get().uri("/lb-retry/second").exchange().expectStatus().isOk();

        assertThat(FAILING.requestCount())
                .as("the failing instance has to be picked, otherwise nothing was retried")
                .isGreaterThanOrEqualTo(1);
        assertThat(HEALTHY.requestCount())
                .as("the retry has to land on the healthy instance for the client to see 200")
                .isGreaterThanOrEqualTo(1);
    }
}

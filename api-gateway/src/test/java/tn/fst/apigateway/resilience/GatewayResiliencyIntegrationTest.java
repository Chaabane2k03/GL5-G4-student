package tn.fst.apigateway.resilience;

import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.reactive.AutoConfigureWebTestClient;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.reactive.server.FluxExchangeResult;
import org.springframework.test.web.reactive.server.WebTestClient;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Drives the four resiliency patterns through a real gateway context and asserts the
 * status the client actually receives.
 *
 * <p>Each pattern gets its own route id so it gets its own circuit breaker instance. That
 * matters: breaker state is shared per instance, so reusing one route across tests would
 * make them interfere and the order of execution would decide the results.
 *
 * <p>Routing goes through {@code lb://}, the same as production, so the filters are
 * exercised with a load balancer in the chain rather than pointed at a literal address.
 * The faults come from {@link FailingStubBackend}, which can be made to fail, to fail a
 * fixed number of times, or to respond slowly.
 *
 * <p>Runs against {@link ResiliencyTestApplication} rather than the production
 * application: no security chain, its own routes, and a principal supplied by
 * {@link TestPrincipalWebFilter} so the rate limiter's key resolver has a real key to
 * resolve. Authentication itself is covered by the existing security tests.
 */
@SpringBootTest(classes = {
        ResiliencyTestApplication.class,
        ResilienceConfig.class,
        RouteBulkheadFilter.class,
        GatewayFallbackController.class,
        TestPrincipalWebFilter.class},
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
                // Every route targets its backend through lb://, not a literal address.
                // That matches production, and it is not a cosmetic difference: a load
                // balancer joins the filter chain, and Spring Cloud LoadBalancer has its
                // own retry settings that are separate from the gateway's Retry filter.
                // Pointing the routes at http://localhost:<port> would skip all of it.
                // SimpleDiscoveryClient supplies the instance list, registered in
                // backendProperties() below.
                //
                // Each route gets its own service id so load balancer state stays
                // isolated per route, the way production isolates one service from
                // another.

                // Circuit breaker route: trips after 4 failures of 4, stays open 2s.
                "spring.cloud.gateway.server.webflux.routes[0].id=breaker-route",
                "spring.cloud.gateway.server.webflux.routes[0].uri=lb://resiliency-breaker-backend",
                "spring.cloud.gateway.server.webflux.routes[0].predicates[0]=Path=/breaker/**",
                "spring.cloud.gateway.server.webflux.routes[0].filters[0].name=CircuitBreaker",
                "spring.cloud.gateway.server.webflux.routes[0].filters[0].args.name=breaker-test",
                "spring.cloud.gateway.server.webflux.routes[0].filters[0].args.fallbackUri=forward:/fallback/breaker-service",
                // Required, and easy to miss: without this the CircuitBreaker filter only
                // counts transport-level errors as failures. A backend that answers
                // "503 Service Unavailable" is a perfectly good HTTP response, so the
                // breaker would sit CLOSED forever and never trip.
                "spring.cloud.gateway.server.webflux.routes[0].filters[0].args.statusCodes=500,503,504",

                // Retry route: 3 retries on GET only.
                "spring.cloud.gateway.server.webflux.routes[1].id=retry-route",
                "spring.cloud.gateway.server.webflux.routes[1].uri=lb://resiliency-retry-backend",
                "spring.cloud.gateway.server.webflux.routes[1].predicates[0]=Path=/retry/**",
                "spring.cloud.gateway.server.webflux.routes[1].filters[0].name=Retry",
                "spring.cloud.gateway.server.webflux.routes[1].filters[0].args.retries=3",
                "spring.cloud.gateway.server.webflux.routes[1].filters[0].args.methods=GET",
                "spring.cloud.gateway.server.webflux.routes[1].filters[0].args.statuses=BAD_GATEWAY,SERVICE_UNAVAILABLE",
                "spring.cloud.gateway.server.webflux.routes[1].filters[0].args.backoff.firstBackoff=10ms",
                "spring.cloud.gateway.server.webflux.routes[1].filters[0].args.backoff.maxBackoff=50ms",
                "spring.cloud.gateway.server.webflux.routes[1].filters[0].args.backoff.factor=2",

                // Retry-on-POST route, to prove writes are not retried.
                "spring.cloud.gateway.server.webflux.routes[2].id=no-retry-on-write-route",
                "spring.cloud.gateway.server.webflux.routes[2].uri=lb://resiliency-write-backend",
                "spring.cloud.gateway.server.webflux.routes[2].predicates[0]=Path=/write/**",
                "spring.cloud.gateway.server.webflux.routes[2].filters[0].name=Retry",
                "spring.cloud.gateway.server.webflux.routes[2].filters[0].args.retries=3",
                "spring.cloud.gateway.server.webflux.routes[2].filters[0].args.methods=GET",
                "spring.cloud.gateway.server.webflux.routes[2].filters[0].args.statuses=BAD_GATEWAY,SERVICE_UNAVAILABLE",
                "spring.cloud.gateway.server.webflux.routes[2].filters[0].args.backoff.firstBackoff=10ms",
                "spring.cloud.gateway.server.webflux.routes[2].filters[0].args.backoff.maxBackoff=50ms",
                "spring.cloud.gateway.server.webflux.routes[2].filters[0].args.backoff.factor=2",

                // Rate limiter route: capacity 3, refill every 60s so a burst stays denied.
                "spring.cloud.gateway.server.webflux.routes[3].id=ratelimit-route",
                "spring.cloud.gateway.server.webflux.routes[3].uri=lb://resiliency-ratelimit-backend",
                "spring.cloud.gateway.server.webflux.routes[3].predicates[0]=Path=/limited/**",
                "spring.cloud.gateway.server.webflux.routes[3].filters[0].name=RequestRateLimiter",
                "spring.cloud.gateway.server.webflux.routes[3].filters[0].args.rate-limiter=#{@bucket4jRateLimiter}",
                "spring.cloud.gateway.server.webflux.routes[3].filters[0].args.key-resolver=#{@principalNameKeyResolver}",
                "spring.cloud.gateway.server.webflux.routes[3].filters[0].args.bucket4j-rate-limiter.capacity=3",
                "spring.cloud.gateway.server.webflux.routes[3].filters[0].args.bucket4j-rate-limiter.refillPeriod=60s",
                "spring.cloud.gateway.server.webflux.routes[3].filters[0].args.status-code=TOO_MANY_REQUESTS",
                // Kept at its default (true). TestPrincipalWebFilter supplies a real
                // principal, so the key resolver produces a real key and limiting is
                // genuinely exercised rather than skipped for want of one.
                "spring.cloud.gateway.server.webflux.routes[3].filters[0].args.deny-empty-key=true",

                // Bulkhead route, deliberately WITHOUT a circuit breaker. A bulkhead sheds
                // with 503, and a breaker watching statusCodes=500,503,504 would record
                // that shed as a failure, trip, and serve its own fallback. The shed
                // response would then carry the fallback body instead of bulkhead-full,
                // and the two patterns could no longer be told apart.
                "spring.cloud.gateway.server.webflux.routes[4].id=bulkhead-route",
                "spring.cloud.gateway.server.webflux.routes[4].uri=lb://resiliency-bulkhead-backend",
                "spring.cloud.gateway.server.webflux.routes[4].predicates[0]=Path=/bulkheaded/**"})
@ActiveProfiles("resiliency-test")
class GatewayResiliencyIntegrationTest {

    private static final FailingStubBackend BACKEND = startBackend();

    /**
     * One service id per test route, each advertised as a single instance: the stub
     * backend. This is what makes the {@code lb://} URIs resolvable without Eureka, the
     * same approach {@code GatewayRoutingIntegrationTest} takes for the real service ids.
     */
    private static final List<String> STUB_SERVICE_IDS = List.of(
            "resiliency-breaker-backend",
            "resiliency-retry-backend",
            "resiliency-write-backend",
            "resiliency-ratelimit-backend",
            "resiliency-bulkhead-backend");

    @DynamicPropertySource
    static void backendProperties(DynamicPropertyRegistry registry) {
        for (String serviceId : STUB_SERVICE_IDS) {
            registry.add("spring.cloud.discovery.client.simple.instances." + serviceId + "[0].uri",
                    BACKEND::uri);
        }
    }

    @AfterAll
    static void stopBackend() {
        BACKEND.close();
    }

    private static FailingStubBackend startBackend() {
        try {
            return new FailingStubBackend();
        } catch (IOException e) {
            throw new IllegalStateException("Unable to start the resiliency stub backend", e);
        }
    }

    @Autowired
    private WebTestClient webTestClient;

    @Autowired
    private CircuitBreakerRegistry circuitBreakerRegistry;

    @LocalServerPort
    private int gatewayPort;

    /**
     * Breaker and rate-limiter state is shared for the life of the context, which Spring
     * caches across all test methods here. Without resetting it a test would inherit an
     * open breaker or an exhausted rate-limit bucket from whichever test ran before it,
     * making results depend on execution order.
     */
    @BeforeEach
    void resetResilienceState() {
        circuitBreakerRegistry.getAllCircuitBreakers()
                .forEach(circuitBreaker -> circuitBreaker.reset());
    }

    /**
     * Reads the live circuit breaker for a route so assertions can be made about its
     * state and metrics, not only the status the client happens to receive.
     */
    private CircuitBreaker breaker(String name) {
        return circuitBreakerRegistry.circuitBreaker(name);
    }

    /**
     * Waits past the open-state duration so the breaker becomes eligible for its trial
     * (half-open) calls. {@code waitDurationInOpenState} is 2s in this profile.
     */
    private void awaitOpenStateExpiry() {
        try {
            Thread.sleep(2500);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(e);
        }
    }

    /**
     * Drains a reactive response body so it can be asserted on as a String.
     */
    private static String readBody(FluxExchangeResult<String> result) {
        return String.join("", result.getResponseBody().toIterable());
    }

    /**
     * Blocks until the stub backend has received at least {@code expected} requests.
     * Used to synchronise on genuinely concurrent work instead of sleeping for a guess,
     * which is what makes timing-sensitive tests either flaky or needlessly slow.
     */
    private void awaitBackendRequestCount(int expected) {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
        while (BACKEND.requestCount() < expected) {
            if (System.nanoTime() > deadline) {
                throw new IllegalStateException(
                        "Timed out waiting for " + expected + " backend requests; saw "
                                + BACKEND.requestCount());
            }
            try {
                Thread.sleep(10);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException(e);
            }
        }
    }

    // ------------------------------------------------------------------
    // Circuit breaker
    // ------------------------------------------------------------------

    @Test
    void circuitBreakerOpensAfterRepeatedFailuresAndServesTheFallback() {
        BACKEND.recover();
        BACKEND.failPermanently();

        CircuitBreaker cb = breaker("breaker-test");

        // The window is 4 calls at a 50% failure threshold, so the fourth failure trips it.
        for (int i = 0; i < 4; i++) {
            webTestClient.get().uri("/breaker/api/departments")
                    .exchange()
                    .expectStatus().isEqualTo(503);
        }

        assertThat(cb.getState())
                .as("repeated 5xx responses must open the breaker")
                .isEqualTo(CircuitBreaker.State.OPEN);

        // The client gets a problem+json body, a Retry-After hint, and the name of the
        // service that is down, so it can retry rather than guess.
        webTestClient.get().uri("/breaker/api/departments")
                .exchange()
                .expectStatus().isEqualTo(503)
                .expectHeader().value("Content-Type", Matchers.containsString("application/problem+json"))
                .expectHeader().valueEquals("Retry-After", "10")
                .expectBody()
                .jsonPath("$.status").isEqualTo(503)
                .jsonPath("$.service").isEqualTo("breaker-service")
                .jsonPath("$.detail")
                .value(Matchers.containsString("breaker-service"));
    }

    @Test
    void circuitBreakerStopsCallingTheBackendOnceItIsOpen() {
        BACKEND.recover();
        BACKEND.failPermanently();

        CircuitBreaker cb = breaker("breaker-test");

        // Trip it, then take note of the backend call count at that point.
        for (int i = 0; i < 6; i++) {
            webTestClient.get().uri("/breaker/api/courses").exchange().expectStatus().isEqualTo(503);
        }
        assertThat(cb.getState()).isEqualTo(CircuitBreaker.State.OPEN);

        int callsWhenOpened = BACKEND.requestCount();
        int failuresWhenOpened = cb.getMetrics().getNumberOfFailedCalls();

        // Further requests are rejected by the breaker without reaching the backend.
        // This is the point of the pattern: a failing dependency costs the gateway
        // nothing while it is down.
        for (int i = 0; i < 5; i++) {
            webTestClient.get().uri("/breaker/api/courses").exchange().expectStatus().isEqualTo(503);
        }

        assertThat(BACKEND.requestCount())
                .as("an open breaker must not call the failing backend")
                .isEqualTo(callsWhenOpened);
        assertThat(cb.getMetrics().getNumberOfFailedCalls())
                .as("a rejected call must not be recorded as a new failure")
                .isEqualTo(failuresWhenOpened);
    }

    @Test
    void circuitBreakerRecoversOnceTheBackendIsHealthyAgain() {
        BACKEND.failPermanently();

        CircuitBreaker cb = breaker("breaker-test");

        for (int i = 0; i < 4; i++) {
            webTestClient.get().uri("/breaker/api/enrollments").exchange().expectStatus().isEqualTo(503);
        }
        assertThat(cb.getState()).isEqualTo(CircuitBreaker.State.OPEN);

        BACKEND.recover();
        awaitOpenStateExpiry();

        // The next call is a trial: permittedNumberOfCallsInHalfOpenState is 2. A healthy
        // backend answers it, and the breaker closes again.
        webTestClient.get().uri("/breaker/api/enrollments")
                .exchange()
                .expectStatus().isEqualTo(200);

        webTestClient.get().uri("/breaker/api/enrollments")
                .exchange()
                .expectStatus().isEqualTo(200);

        assertThat(cb.getState())
                .as("successful trial calls must close the breaker")
                .isEqualTo(CircuitBreaker.State.CLOSED);
    }

    @Test
    void healthyBackendIsNeverTripped() {
        BACKEND.recover();
        BACKEND.resetRequestCount();

        CircuitBreaker cb = breaker("breaker-test");

        for (int i = 0; i < 6; i++) {
            webTestClient.get().uri("/breaker/api/students")
                    .exchange()
                    .expectStatus().isEqualTo(200);
        }

        assertThat(cb.getState()).isEqualTo(CircuitBreaker.State.CLOSED);
        assertThat(cb.getMetrics().getNumberOfFailedCalls())
                .as("a healthy backend must not record failures")
                .isZero();
        assertThat(BACKEND.requestCount())
                .as("a closed breaker passes every call through")
                .isEqualTo(6);
    }

    /**
     * Spring Cloud CircuitBreaker wraps each call in a TimeLimiter whose library default
     * is one second. At that default a backend answering in 1.2 s is recorded as a
     * failure and the caller receives the 503 fallback although the service is healthy
     * (this is what made the api-gateway security tests flake on a loaded CI agent).
     * The gateway raises the timeout in application.properties
     * ({@code resilience4j.timelimiter.configs.default.timeout-duration}); this test keeps
     * it from silently regressing to the one-second default.
     */
    @Test
    void slowButHealthyBackendIsNotTreatedAsAFailure() {
        BACKEND.recover();
        BACKEND.delayEachRequestBy(1200);

        try {
            webTestClient.get().uri("/breaker/api/courses")
                    .exchange()
                    .expectStatus().isEqualTo(200);

            assertThat(breaker("breaker-test").getMetrics().getNumberOfFailedCalls())
                    .as("a response slower than one second but well inside the timeout is not a failure")
                    .isZero();
        } finally {
            BACKEND.delayEachRequestBy(0);
        }
    }

    // ------------------------------------------------------------------
    // Retry
    // ------------------------------------------------------------------

    @Test
    void retryRecoversWhenTheBackendFailsOnlyTheFirstAttempts() {
        BACKEND.recover();
        BACKEND.resetRequestCount();

        // Fails twice, then succeeds: within the 3 allowed retries.
        BACKEND.failFirst(2);

        webTestClient.get().uri("/retry/api/courses")
                .exchange()
                .expectStatus().isEqualTo(200);

        assertThat(BACKEND.requestCount())
                .as("one client request should have produced 3 backend attempts")
                .isEqualTo(3);
    }

    @Test
    void retryGivesUpAfterExhaustingItsAttempts() {
        BACKEND.recover();
        BACKEND.resetRequestCount();

        BACKEND.failFirst(99);

        webTestClient.get().uri("/retry/api/departments")
                .exchange()
                .expectStatus().isEqualTo(503);

        assertThat(BACKEND.requestCount())
                .as("3 retries means 4 total attempts, then it gives up")
                .isEqualTo(4);
    }

    @Test
    void retryIsNotAppliedToWrites() {
        BACKEND.recover();
        BACKEND.resetRequestCount();

        BACKEND.failPermanently();

        // POST is not in the retry methods list, so it must be attempted exactly once.
        // Retrying a write risks duplicating it, which is why methods=GET above.
        webTestClient.post().uri("/write/api/courses")
                .exchange()
                .expectStatus().isEqualTo(503);

        assertThat(BACKEND.requestCount())
                .as("a failed POST must not be retried")
                .isEqualTo(1);
    }

    // ------------------------------------------------------------------
    // Rate limiter
    // ------------------------------------------------------------------

    /**
     * Uses its own route so it does not depend on the rate-limiter bucket state left
     * behind by {@link #rateLimiterShedsAtTheGatewayWithoutForwardingThrottledRequests()}.
     * Both point at the same limiter, so this one drains whatever tokens remain rather
     * than assuming a full bucket.
     */
    @Test
    void rateLimiterReturnsTooManyRequestsOnceTheBucketIsEmpty() {
        BACKEND.recover();

        // Capacity is 3 with a 60s refill. Drain the bucket, then confirm the next
        // call is refused and stays refused.
        for (int i = 0; i < 3; i++) {
            webTestClient.get().uri("/limited/api/courses").exchange();
        }

        webTestClient.get().uri("/limited/api/courses")
                .exchange()
                .expectStatus().isEqualTo(429);

        // Still denied: the refill period is far longer than this test.
        webTestClient.get().uri("/limited/api/courses")
                .exchange()
                .expectStatus().isEqualTo(429);
    }

    @Test
    void rateLimiterShedsAtTheGatewayWithoutForwardingThrottledRequests() {
        BACKEND.recover();
        // Rate-limiter buckets are keyed per caller and live in the shared proxy manager,
        // so the count is asserted as "never more than capacity" rather than exactly
        // capacity: the bucket may still hold tokens consumed by an earlier test.
        int before = BACKEND.requestCount();

        int statuses429 = 0;
        for (int i = 0; i < 6; i++) {
            var status = webTestClient.get().uri("/limited/api/departments")
                    .exchange()
                    .returnResult(String.class)
                    .getStatus();
            if (status.value() == 429) {
                statuses429++;
            }
        }

        assertThat(statuses429)
                .as("a 6-request burst against a capacity of 3 must be throttled")
                .isPositive();

        int forwarded = BACKEND.requestCount() - before;
        assertThat(forwarded)
                .as("throttled requests must be shed at the gateway, not forwarded")
                .isLessThan(6);
    }

    // ------------------------------------------------------------------
    // Bulkhead
    // ------------------------------------------------------------------

    @Test
    void bulkheadShedsRequestsBeyondTheConfiguredConcurrency() throws Exception {
        BACKEND.recover();
        BACKEND.resetRequestCount();
        // Each backend call holds its response for 800ms, so all three requests overlap and
        // the limit is actually exercised rather than raced past.
        BACKEND.delayEachRequestBy(800);

        var executor = Executors.newFixedThreadPool(3);
        try {
            // Three concurrent requests against max-concurrent=2: exactly two are admitted
            // and one is shed. Counting the outcomes rather than pinning them to specific
            // URLs keeps the test independent of which request happens to lose the race.
            List<CompletableFuture<FluxExchangeResult<String>>> inFlight = List.of(
                    CompletableFuture.supplyAsync(
                            () -> webTestClient.get().uri("/bulkheaded/api/a")
                                    .exchange().returnResult(String.class), executor),
                    CompletableFuture.supplyAsync(
                            () -> webTestClient.get().uri("/bulkheaded/api/b")
                                    .exchange().returnResult(String.class), executor),
                    CompletableFuture.supplyAsync(
                            () -> webTestClient.get().uri("/bulkheaded/api/c")
                                    .exchange().returnResult(String.class), executor));

            List<FluxExchangeResult<String>> results = new ArrayList<>();
            for (var future : inFlight) {
                results.add(future.get(10, TimeUnit.SECONDS));
            }

            assertThat(results).hasSize(3);

            long admitted = results.stream()
                    .filter(result -> result.getStatus().is2xxSuccessful())
                    .count();
            List<FluxExchangeResult<String>> shed = results.stream()
                    .filter(result -> result.getStatus().value() == 503)
                    .toList();

            assertThat(admitted)
                    .as("max-concurrent=2 must admit exactly two of three concurrent requests")
                    .isEqualTo(2);
            assertThat(shed)
                    .as("the remaining request must be shed, not queued")
                    .hasSize(1);

            // The shed response must say why, so an operator can tell a full bulkhead from
            // an unavailable service: both are 503, but only one means "try again shortly".
            assertThat(readBody(shed.get(0)))
                    .contains("\"reason\":\"bulkhead-full\"")
                    .contains("\"route\":\"bulkhead-route\"")
                    .contains("\"maxConcurrent\":2");
        } finally {
            BACKEND.delayEachRequestBy(0);
            executor.shutdownNow();
        }
    }

    @Test
    void bulkheadReleasesItsSlotsAfterRequestsComplete() {
        BACKEND.recover();

        // Back-to-back requests must all be admitted. A slot leaked in doFinally would
        // eventually exhaust the bulkhead and start shedding perfectly healthy requests.
        for (int i = 0; i < 6; i++) {
            webTestClient.get().uri("/bulkheaded/api/seq" + i)
                    .exchange()
                    .expectStatus().isEqualTo(200);
        }
    }

    // ------------------------------------------------------------------
    // Fallback controller in isolation
    // ------------------------------------------------------------------

    @Test
    void fallbackEndpointNamesTheServiceAndAdvisesRetrying() {
        webTestClient.get().uri("/fallback/some-service")
                .exchange()
                .expectStatus().isEqualTo(503)
                .expectHeader().valueEquals("Retry-After", "10")
                .expectBody()
                .jsonPath("$.status").isEqualTo(503)
                .jsonPath("$.title").isEqualTo("Service Unavailable")
                .jsonPath("$.service").isEqualTo("some-service");
    }

    @Test
    void fallbackEndpointAnswersForEveryHttpMethod() {
        webTestClient.post().uri("/fallback/some-service").exchange().expectStatus().isEqualTo(503);
        webTestClient.put().uri("/fallback/some-service").exchange().expectStatus().isEqualTo(503);
        webTestClient.delete().uri("/fallback/some-service").exchange().expectStatus().isEqualTo(503);
        webTestClient.patch().uri("/fallback/some-service").exchange().expectStatus().isEqualTo(503);
    }

    /**
     * The gateway must never invent a fallback that reports success: the point of the
     * 503 is that the client knows not to trust the response.
     */
    @Test
    void fallbackEndpointNeverReturnsTwoHundred() {
        var body = webTestClient.get().uri("/fallback/anything")
                .exchange()
                .expectStatus().isEqualTo(503)
                .expectBody(String.class)
                .returnResult()
                .getResponseBody();

        assertThat(body).doesNotContain("\"status\":200");
    }

    /**
     * Guards the ordering assumption the route config relies on: a path that matches no
     * route must still 404 rather than falling through to a fallback.
     */
    @Test
    void unknownPathsAreNotRoutedAndDoNotReachABackend() {
        BACKEND.recover();
        BACKEND.resetRequestCount();

        webTestClient.get().uri("/nothing-here")
                .exchange()
                .expectStatus().isNotFound();

        assertThat(BACKEND.requestCount()).isZero();
    }
}
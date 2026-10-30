package tn.fst.apigateway.resilience;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.cloud.gateway.route.RouteDefinition;
import org.springframework.cloud.gateway.route.RouteDefinitionLocator;
import org.springframework.core.env.Environment;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Asserts the production route definitions actually carry the resiliency filters and
 * breaker settings.
 *
 * <p>Loads the real {@code application.properties} rather than the test profile's routes,
 * because the thing worth protecting here is the shipped configuration: a filter that is
 * present in code but missing from the route definition silently does nothing. The
 * behavioural side of each pattern is covered by
 * {@link GatewayResiliencyIntegrationTest}.
 *
 * <p>These assertions are deliberately about configuration, not about the gateway actually
 * invoking the filters. If someone deletes the CircuitBreaker filter from a route, this
 * test says so directly instead of leaving it to be discovered in production.
 */
@SpringBootTest
@ActiveProfiles("resiliency-test")
class ResiliencyRouteConfigurationTest {

    private static final List<String> PRODUCTION_ROUTES =
            List.of("department-service", "course-service", "enrollment-service", "student-service");

    @Autowired
    private RouteDefinitionLocator routeDefinitionLocator;

    @Autowired
    private Environment environment;

    private Map<String, RouteDefinition> productionRoutes() {
        List<RouteDefinition> definitions = routeDefinitionLocator.getRouteDefinitions().collectList().block();
        assertThat(definitions).isNotNull();

        Map<String, RouteDefinition> byId = definitions.stream()
                .collect(java.util.stream.Collectors.toMap(RouteDefinition::getId, definition -> definition));

        assertThat(byId.keySet())
                .as("all four production routes must still be defined")
                .containsAll(PRODUCTION_ROUTES);
        return byId;
    }

    @Test
    void everyProductionRouteHasACircuitBreakerPointingAtItsOwnFallback() {
        productionRoutes().forEach((id, route) -> {
            var circuitBreaker = route.getFilters().stream()
                    .filter(filter -> "CircuitBreaker".equals(filter.getName()))
                    .findFirst();

            assertThat(circuitBreaker)
                    .as("route %s must carry a CircuitBreaker filter", id)
                    .isPresent();

            var args = circuitBreaker.orElseThrow().getArgs();
            assertThat(args.get("fallbackUri"))
                    .as("route %s needs a fallbackUri or the breaker has nothing to serve", id)
                    .isEqualTo("forward:/fallback/" + id);
            assertThat(args.get("name"))
                    .as("route %s must name its breaker, or all routes share one instance", id)
                    .isNotBlank();
            assertThat(args.get("statusCodes"))
                    .as("route %s: without statusCodes a 5xx response is not counted as a "
                            + "failure and the breaker never trips", id)
                    .contains("503");
        });
    }

    @Test
    void circuitBreakerNamesAreUniquePerRoute() {
        var names = productionRoutes().values().stream()
                .map(route -> route.getFilters().stream()
                        .filter(filter -> "CircuitBreaker".equals(filter.getName()))
                        .findFirst()
                        .orElseThrow()
                        .getArgs()
                        .get("name"))
                .toList();

        assertThat(names)
                .as("distinct names keep distinct breaker state per service")
                .doesNotHaveDuplicates();
    }

    @Test
    void everyProductionRouteRetriesOnlySafeMethods() {
        productionRoutes().forEach((id, route) -> {
            var retry = route.getFilters().stream()
                    .filter(filter -> "Retry".equals(filter.getName()))
                    .findFirst();

            assertThat(retry)
                    .as("route %s must carry a Retry filter", id)
                    .isPresent();

            assertThat(retry.orElseThrow().getArgs().get("methods"))
                    .as("route %s must retry GET only; retrying a write can duplicate it", id)
                    .isEqualTo("GET");
        });
    }

    @Test
    void everyProductionRouteIsRateLimited() {
        productionRoutes().forEach((id, route) -> {
            var rateLimiter = route.getFilters().stream()
                    .filter(filter -> "RequestRateLimiter".equals(filter.getName()))
                    .findFirst();

            assertThat(rateLimiter)
                    .as("route %s must carry a RequestRateLimiter filter", id)
                    .isPresent();

            var args = rateLimiter.orElseThrow().getArgs();
            assertThat(args.get("key-resolver"))
                    .as("route %s must key on the authenticated principal", id)
                    .isEqualTo("#{@principalNameKeyResolver}");
            assertThat(args.get("rate-limiter"))
                    .as("route %s must use the Bucket4j limiter, not the Redis one", id)
                    .isEqualTo("#{@bucket4jRateLimiter}");
            assertThat(args.get("bucket4j-rate-limiter.capacity"))
                    .as("route %s needs a positive capacity", id)
                    .isNotNull();
            assertThat(args.get("deny-empty-key"))
                    .as("route %s: an empty key must not 403 the public Swagger and actuator paths", id)
                    .isEqualTo("false");
        });
    }

    @Test
    void circuitBreakerDefaultsAreTunedAndReadable() {
        String prefix = "resilience4j.circuitbreaker.configs.default.";

        // minimumNumberOfCalls must be at least the window size, otherwise the failure
        // rate is never evaluated and the breaker cannot trip.
        assertThat(environment.getProperty(prefix + "minimum-number-of-calls", Integer.class))
                .isNotNull()
                .isGreaterThanOrEqualTo(environment.getProperty(prefix + "sliding-window-size", Integer.class));

        assertThat(environment.getProperty(prefix + "failure-rate-threshold", Integer.class))
                .isBetween(1, 100);
        assertThat(environment.getProperty(prefix + "wait-duration-in-open-state"))
                .isNotBlank();
        assertThat(environment.getProperty(prefix + "permitted-number-of-calls-in-half-open-state", Integer.class))
                .isGreaterThan(0);
    }

    @Test
    void bulkheadIsEnabledWithAConfiguredLimit() {
        assertThat(environment.getProperty("gateway.bulkhead.enabled", Boolean.class)).isTrue();
        assertThat(environment.getProperty("gateway.bulkhead.max-concurrent", Integer.class))
                .isGreaterThan(0);
    }

    }
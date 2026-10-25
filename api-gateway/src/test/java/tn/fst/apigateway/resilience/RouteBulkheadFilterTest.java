package tn.fst.apigateway.resilience;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.route.Route;
import org.springframework.cloud.gateway.support.ServerWebExchangeUtils;
import org.springframework.core.Ordered;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import reactor.core.publisher.Mono;

import java.net.URI;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;

class RouteBulkheadFilterTest {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final String ROUTE_ID = "course-service";

    private static MockServerWebExchange exchangeWithRoute(String routeId) {
        MockServerWebExchange exchange = MockServerWebExchange.from(
                MockServerHttpRequest.get("/course/api/courses").build());
        if (routeId != null) {
            Route route = Route.async()
                    .id(routeId)
                    .uri(URI.create("lb://" + routeId))
                    .predicate(exchangePredicate -> true)
                    .build();
            exchange.getAttributes().put(ServerWebExchangeUtils.GATEWAY_ROUTE_ATTR, route);
        }
        return exchange;
    }

    @Test
    void rejectsANonPositiveConcurrencyLimit() {
        assertThatThrownBy(() -> new RouteBulkheadFilter(OBJECT_MAPPER, true, 0, List.of()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("max-concurrent");
    }

    @Test
    void treatsANullRouteListAsEveryRoute() {
        RouteBulkheadFilter filter = new RouteBulkheadFilter(OBJECT_MAPPER, true, 2, null);
        AtomicInteger calls = new AtomicInteger();

        filter.filter(exchangeWithRoute(ROUTE_ID), chain(calls)).block();

        assertThat(calls).hasValue(1);
    }

    @Test
    void passesThroughWhenDisabled() {
        RouteBulkheadFilter filter = new RouteBulkheadFilter(OBJECT_MAPPER, false, 1, List.of());
        AtomicInteger calls = new AtomicInteger();

        filter.filter(exchangeWithRoute(ROUTE_ID), chain(calls)).block();

        assertThat(calls).hasValue(1);
    }

    @Test
    void passesThroughWhenThereIsNoRoute() {
        RouteBulkheadFilter filter = new RouteBulkheadFilter(OBJECT_MAPPER, true, 1, List.of());
        AtomicInteger calls = new AtomicInteger();

        filter.filter(exchangeWithRoute(null), chain(calls)).block();

        assertThat(calls).hasValue(1);
    }

    @Test
    void passesThroughRoutesThatAreNotBulkheaded() {
        RouteBulkheadFilter filter =
                new RouteBulkheadFilter(OBJECT_MAPPER, true, 1, List.of("student-service"));
        AtomicInteger calls = new AtomicInteger();

        filter.filter(exchangeWithRoute(ROUTE_ID), chain(calls)).block();

        assertThat(calls).hasValue(1);
    }

    @Test
    void bulkheadsRoutesThatAreListedExplicitly() {
        RouteBulkheadFilter filter =
                new RouteBulkheadFilter(OBJECT_MAPPER, true, 1, List.of(ROUTE_ID));
        AtomicInteger calls = new AtomicInteger();

        filter.filter(exchangeWithRoute(ROUTE_ID), chain(calls)).block();

        assertThat(calls).hasValue(1);
    }

    @Test
    void releasesTheSlotAfterASuccessfulRequest() {
        RouteBulkheadFilter filter = new RouteBulkheadFilter(OBJECT_MAPPER, true, 1, List.of());
        AtomicInteger calls = new AtomicInteger();

        filter.filter(exchangeWithRoute(ROUTE_ID), chain(calls)).block();
        filter.filter(exchangeWithRoute(ROUTE_ID), chain(calls)).block();

        assertThat(calls).hasValue(2);
    }

    @Test
    void shedsConcurrentRequestsBeyondTheLimit() {
        RouteBulkheadFilter filter = new RouteBulkheadFilter(OBJECT_MAPPER, true, 1, List.of());

        // Hold the only permit: the chain never completes.
        filter.filter(exchangeWithRoute(ROUTE_ID), exchange -> Mono.never());

        MockServerWebExchange shedExchange = exchangeWithRoute(ROUTE_ID);
        filter.filter(shedExchange, exchange -> Mono.empty()).block();

        assertThat(shedExchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(shedExchange.getResponse().getHeaders().getContentType())
                .isEqualTo(MediaType.APPLICATION_PROBLEM_JSON);
        assertThat(shedExchange.getResponse().getBodyAsString().block())
                .contains("\"reason\":\"bulkhead-full\"")
                .contains("\"route\":\"" + ROUTE_ID + "\"")
                .contains("\"maxConcurrent\":1");
    }

    @Test
    void fallsBackToAFixedBodyWhenSerializationFails() throws JsonProcessingException {
        ObjectMapper failingMapper = mock(ObjectMapper.class);
        doThrow(mock(JsonProcessingException.class))
                .when(failingMapper).writeValueAsBytes(any());

        RouteBulkheadFilter filter = new RouteBulkheadFilter(failingMapper, true, 1, List.of());
        filter.filter(exchangeWithRoute(ROUTE_ID), exchange -> Mono.never());

        MockServerWebExchange shedExchange = exchangeWithRoute(ROUTE_ID);
        filter.filter(shedExchange, exchange -> Mono.empty()).block();

        assertThat(shedExchange.getResponse().getBodyAsString().block())
                .isEqualTo("{\"title\":\"Service Unavailable\",\"status\":503}");
    }

    @Test
    void runsJustBeforeTheRoutingFilter() {
        RouteBulkheadFilter filter = new RouteBulkheadFilter(OBJECT_MAPPER, true, 1, List.of());

        assertThat(filter.getOrder()).isEqualTo(Ordered.LOWEST_PRECEDENCE - 1000);
    }

    private static GatewayFilterChain chain(AtomicInteger calls) {
        return exchange -> {
            calls.incrementAndGet();
            return Mono.empty();
        };
    }
}

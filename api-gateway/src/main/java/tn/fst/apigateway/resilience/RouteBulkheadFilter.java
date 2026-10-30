package tn.fst.apigateway.resilience;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.cloud.gateway.route.Route;
import org.springframework.cloud.gateway.support.ServerWebExchangeUtils;
import org.springframework.core.Ordered;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.core.io.buffer.DataBufferFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Semaphore;

/**
 * Bulkhead isolation between the backend services.
 *
 * <p>Without it every downstream call shares one pool of gateway connections, so one
 * service that stops responding slowly starves the others. Each route instead gets its own
 * fixed number of in-flight slots; once a route's slots are taken, further requests to
 * that route are shed immediately with {@code 503} instead of queueing behind the stuck
 * ones. Healthy services keep working.
 *
 * <p>This is the deck's ship-bulkhead idea expressed at the edge. The permit is held for
 * the whole downstream call, retries included, because the slot is taken before the route
 * filters run and released in {@code doFinally}.
 *
 * <p>Applies to reads and writes alike: a bulkhead limits concurrency, it does not make
 * writes safe to retry.
 */
@Component
public class RouteBulkheadFilter implements GlobalFilter, Ordered {

    private static final Logger log = LoggerFactory.getLogger(RouteBulkheadFilter.class);

    /**
     * Sorts this among the other global filters only: global pre-phase filters all run
     * before a route's own filters, which is what puts the slot acquisition outside the
     * circuit breaker and retry. Kept below {@link Ordered#LOWEST_PRECEDENCE} so the
     * release still happens before the routing filter unwinds.
     */
    private static final int ORDER = Ordered.LOWEST_PRECEDENCE - 1000;

    private static final byte[] SERIALIZATION_FAILURE =
            "{\"title\":\"Service Unavailable\",\"status\":503}".getBytes(StandardCharsets.UTF_8);

    private final boolean enabled;
    private final int maxConcurrentPerRoute;
    private final List<String> configuredRoutes;
    private final ObjectMapper objectMapper;

    private final Map<String, Semaphore> bulkheads = new ConcurrentHashMap<>();

    public RouteBulkheadFilter(
            ObjectMapper objectMapper,
            @Value("${gateway.bulkhead.enabled:true}") boolean enabled,
            @Value("${gateway.bulkhead.max-concurrent:20}") int maxConcurrentPerRoute,
            @Value("${gateway.bulkhead.routes:}") List<String> configuredRoutes) {
        if (maxConcurrentPerRoute < 1) {
            throw new IllegalArgumentException(
                    "gateway.bulkhead.max-concurrent must be at least 1 but was " + maxConcurrentPerRoute);
        }
        this.objectMapper = objectMapper;
        this.enabled = enabled;
        this.maxConcurrentPerRoute = maxConcurrentPerRoute;
        this.configuredRoutes = configuredRoutes == null ? List.of() : configuredRoutes;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        Route route = exchange.getAttribute(ServerWebExchangeUtils.GATEWAY_ROUTE_ATTR);
        if (!enabled || route == null || !isBulkheaded(route.getId())) {
            return chain.filter(exchange);
        }

        Semaphore bulkhead = bulkheads.computeIfAbsent(route.getId(), id -> new Semaphore(maxConcurrentPerRoute));

        if (!bulkhead.tryAcquire()) {
            log.warn("Bulkhead full for route '{}', shedding request {}",
                    route.getId(), exchange.getRequest().getPath().value());
            return shed(exchange, route.getId());
        }

        // Released whatever the outcome, so an errored or cancelled call cannot leak a slot.
        return chain.filter(exchange).doFinally(signalType -> bulkhead.release());
    }

    /**
     * An empty {@code gateway.bulkhead.routes} list means every route is bulkheaded.
     */
    private boolean isBulkheaded(String routeId) {
        return configuredRoutes.isEmpty() || configuredRoutes.contains(routeId);
    }

    private Mono<Void> shed(ServerWebExchange exchange, String routeId) {
        ServerHttpResponse response = exchange.getResponse();
        response.setStatusCode(HttpStatus.SERVICE_UNAVAILABLE);
        response.getHeaders().setContentType(MediaType.APPLICATION_PROBLEM_JSON);

        ProblemDetail body = ProblemDetail.forStatusAndDetail(HttpStatus.SERVICE_UNAVAILABLE,
                "Too many requests in flight for '" + routeId + "'. Please retry shortly.");
        body.setTitle("Service Unavailable");
        body.setType(URI.create("https://httpstatuses.com/503"));
        body.setInstance(URI.create(exchange.getRequest().getPath().value()));
        body.setProperty("route", routeId);
        body.setProperty("reason", "bulkhead-full");
        body.setProperty("maxConcurrent", maxConcurrentPerRoute);

        DataBufferFactory bufferFactory = response.bufferFactory();
        DataBuffer buffer = bufferFactory.wrap(serialize(body));
        return response.writeWith(Mono.just(buffer));
    }

    private byte[] serialize(ProblemDetail body) {
        try {
            return objectMapper.writeValueAsBytes(body);
        } catch (JsonProcessingException e) {
            log.error("Unable to serialise the bulkhead problem detail", e);
            return SERIALIZATION_FAILURE;
        }
    }

    @Override
    public int getOrder() {
        return ORDER;
    }
}
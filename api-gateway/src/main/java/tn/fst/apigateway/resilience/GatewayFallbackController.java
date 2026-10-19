package tn.fst.apigateway.resilience;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.net.URI;
import java.security.Principal;
import java.time.Instant;

/**
 * Target of the routes' {@code CircuitBreaker} {@code fallbackUri} (e.g.
 * {@code forward:/fallback/course-service}).
 *
 * <p>When the breaker is open the gateway calls this instead of the failing backend. It
 * answers {@code 503 Service Unavailable} with a {@code application/problem+json} body
 * naming the unavailable service, which is what a client should retry later. Without it
 * the client would receive the raw downstream error, or an unhelpful gateway 500.
 *
 * <p>The path is the service id, so the {@code @PathVariable} is the service that failed.
 */
@RestController
@RequestMapping("/fallback")
public class GatewayFallbackController {

    private static final Logger log = LoggerFactory.getLogger(GatewayFallbackController.class);

    /** Told to clients so they know roughly when to try again. */
    private static final String RETRY_AFTER_SECONDS = "10";

    @RequestMapping(path = "/{service}",
            method = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT,
                    RequestMethod.PATCH, RequestMethod.DELETE})
    public Mono<ResponseEntity<ProblemDetail>> fallback(@PathVariable String service,
                                                       ServerWebExchange exchange) {
        String requestedPath = exchange.getRequest().getPath().value();

        log.warn("Circuit breaker open for service '{}'; serving fallback for {}", service, requestedPath);

        // Composed rather than blocked on: the principal is already resolved by the
        // security WebFilter, but reading it stays non-blocking either way. Anonymous
        // callers get no "caller" field so the body never implies an identity it lacks.
        return exchange.getPrincipal()
                .map(Principal::getName)
                .defaultIfEmpty("")
                .map(caller -> buildFallback(service, requestedPath, caller.isEmpty() ? null : caller));
    }

    private static ResponseEntity<ProblemDetail> buildFallback(String service,
                                                               String requestedPath,
                                                               String caller) {
        ProblemDetail body = ProblemDetail.forStatusAndDetail(HttpStatus.SERVICE_UNAVAILABLE,
                "The '" + service + "' service is temporarily unavailable. Please retry shortly.");
        body.setTitle("Service Unavailable");
        body.setType(URI.create("https://httpstatuses.com/503"));
        body.setInstance(URI.create(requestedPath));
        body.setProperty("service", service);
        body.setProperty("timestamp", Instant.now().toString());
        if (caller != null) {
            body.setProperty("caller", caller);
        }

        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .header(HttpHeaders.RETRY_AFTER, RETRY_AFTER_SECONDS)
                .body(body);
    }
}
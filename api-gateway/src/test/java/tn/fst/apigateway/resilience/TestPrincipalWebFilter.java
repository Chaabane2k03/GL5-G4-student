package tn.fst.apigateway.resilience;

import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Mono;

import java.security.Principal;

/**
 * Stands in for the JWT authentication that {@code SecurityConfig} performs in production,
 * so that {@code principalNameKeyResolver} has a real principal to resolve.
 *
 * <p>This matters for more than convenience. The gateway's key resolver derives the rate
 * limit key from the authenticated principal; with no principal it yields an empty key,
 * and the RequestRateLimiter filter then skips limiting entirely (see
 * {@code denyEmptyKey=false}). Testing rate limiting against an empty key would assert
 * nothing about the production behaviour, where every route is authenticated and always
 * resolves a real key.
 *
 * <p>Ordered first so the principal exists before the gateway's own filters run.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
class TestPrincipalWebFilter implements WebFilter {

    static final String SUBJECT = "resiliency-test-user";

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, WebFilterChain chain) {
        Principal principal = () -> SUBJECT;
        return chain.filter(exchange.mutate().principal(Mono.just(principal)).build());
    }
}
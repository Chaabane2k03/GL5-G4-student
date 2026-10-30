package tn.fst.apigateway.resilience;

import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.actuate.autoconfigure.security.reactive.ReactiveManagementWebSecurityAutoConfiguration;
import org.springframework.boot.autoconfigure.security.oauth2.resource.reactive.ReactiveOAuth2ResourceServerAutoConfiguration;
import org.springframework.boot.autoconfigure.security.reactive.ReactiveSecurityAutoConfiguration;

/**
 * Minimal application used to boot only the resiliency pieces (rate limiter store, the
 * bulkhead filter, the fallback controller) so their behaviour can be asserted directly.
 *
 * <p>The real {@code ApiGatewayApplication} and its production routes are excluded on
 * purpose: reusing them would make every test here share one set of circuit breaker
 * instances, so test order would decide the results.
 *
 * <p>It lives in the {@code resilience} package rather than next to the production
 * application on purpose. {@code @SpringBootTest} discovers its configuration by scanning
 * the test's own package, so a second {@code @SpringBootApplication} in
 * {@code tn.fst.apigateway} would make every existing gateway test fail with
 * "Found multiple @SpringBootConfiguration annotated classes". Keeping it in a
 * subpackage leaves that scan finding exactly one.
 *
 * <p>Component scanning is narrowed to this package, which deliberately leaves out
 * {@code tn.fst.apigateway.security}, so no JWT decoder is needed and the route tests can
 * exercise the patterns without minting a token. {@link TestPrincipalWebFilter} supplies
 * the authenticated principal that {@code principalNameKeyResolver} needs.
 *
 * <p>Security auto-configuration is excluded because Actuator's reactive security
 * auto-configuration installs a chain that demands authentication everywhere, which turns
 * every route assertion into a 401 unrelated to the pattern under test.
 */
@SpringBootApplication(scanBasePackages = "tn.fst.apigateway.resilience")
@ImportAutoConfiguration(exclude = {
        ReactiveSecurityAutoConfiguration.class,
        ReactiveOAuth2ResourceServerAutoConfiguration.class,
        ReactiveManagementWebSecurityAutoConfiguration.class})
public class ResiliencyTestApplication {
}
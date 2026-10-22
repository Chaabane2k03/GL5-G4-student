package tn.fst.apigateway.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.reactive.EnableWebFluxSecurity;
import org.springframework.security.config.web.server.ServerHttpSecurity;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusReactiveJwtDecoder;
import org.springframework.security.oauth2.jwt.ReactiveJwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.ReactiveJwtAuthenticationConverterAdapter;
import org.springframework.security.web.server.SecurityWebFilterChain;
import org.springframework.security.web.server.context.NoOpServerSecurityContextRepository;
import org.springframework.util.StringUtils;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.reactive.CorsConfigurationSource;
import org.springframework.web.cors.reactive.UrlBasedCorsConfigurationSource;
import reactor.core.publisher.Mono;

import java.util.List;

/**
 * WebFlux security configuration for the API Gateway acting as an OAuth2 Resource Server.
 *
 * Implements:
 * 1. Issuer & Audience (aud) validation preventing cross-client token reuse.
 * 2. Scoped client-role extraction (limiting to target client) and Keycloak group normalization.
 * 3. CORS preflight (OPTIONS) permitAll support for SPA frontends.
 * 4. Fine-grained RBAC matrix by HTTP method and domain.
 * 5. Production toggling of Swagger UI / OpenAPI documentation exposure.
 */
@Configuration
@EnableWebFluxSecurity
public class SecurityConfig {

    private static final String[] SWAGGER_DOC_PATHS = {
            "/swagger-ui.html",
            "/swagger-ui/**",
            "/v3/api-docs/**",
            "/webjars/**",
            "/*/v3/api-docs"
    };

    private static final String[] ACTUATOR_PUBLIC_PATHS = {
            "/actuator/health",
            "/actuator/health/**",
            "/actuator/info",
            "/actuator/prometheus"
    };

    @Value("${gateway.security.client-id:api-gateway}")
    private String clientId;

    @Value("${gateway.security.swagger-public:true}")
    private boolean swaggerPublic;

    @Value("${gateway.cors.allowed-origins:*}")
    private List<String> allowedOrigins;

    @Bean
    public SecurityWebFilterChain springSecurityFilterChain(ServerHttpSecurity http) {
        return http
                .csrf(ServerHttpSecurity.CsrfSpec::disable)
                .cors(Customizer.withDefaults())
                .securityContextRepository(NoOpServerSecurityContextRepository.getInstance())
                .authorizeExchange(exchanges -> {
                    // 1. CORS Preflight: Always permit HTTP OPTIONS without authentication
                    exchanges.pathMatchers(HttpMethod.OPTIONS).permitAll();

                    // 2. Read-only Actuator probes: Public for orchestrators and Prometheus
                    exchanges.pathMatchers(ACTUATOR_PUBLIC_PATHS).permitAll();

                    // 3. Swagger / OpenAPI documentation: Public in dev/staging, configurable in production
                    if (swaggerPublic) {
                        exchanges.pathMatchers(SWAGGER_DOC_PATHS).permitAll();
                    } else {
                        exchanges.pathMatchers(SWAGGER_DOC_PATHS).hasRole("ADMIN");
                    }

                    // 4. Runtime Gateway routes management (Actuator): Restricted to ADMIN
                    exchanges.pathMatchers("/actuator/gateway/**").hasRole("ADMIN");

                    // 4b. Circuit breaker fallback endpoints: permitAll BEFORE the
                    // catch-all below. Without this a breaker that opens for an
                    // authenticated caller would answer 403 instead of the 503 that
                    // tells the client to retry, hiding the real failure. These paths
                    // carry no data, only the name of the service that is unavailable.
                    exchanges.pathMatchers("/fallback/**").permitAll();

                    // 5. Fine-grained Role-Based Access Control (RBAC):
                    // Specific HTTP method + path rules MUST come BEFORE generic authenticated()

                    // --- Department Service ---
                    // Departments are institutional structures managed exclusively by ADMIN
                    exchanges.pathMatchers(HttpMethod.POST, "/department/**").hasRole("ADMIN")
                             .pathMatchers(HttpMethod.PUT, "/department/**").hasRole("ADMIN")
                             .pathMatchers(HttpMethod.DELETE, "/department/**").hasRole("ADMIN")
                             .pathMatchers(HttpMethod.GET, "/department/**").authenticated();

                    // --- Course Service ---
                    // Courses created and updated by ADMIN or TEACHER; only ADMIN can delete
                    exchanges.pathMatchers(HttpMethod.POST, "/course/**").hasAnyRole("ADMIN", "TEACHER")
                             .pathMatchers(HttpMethod.PUT, "/course/**").hasAnyRole("ADMIN", "TEACHER")
                             .pathMatchers(HttpMethod.DELETE, "/course/**").hasRole("ADMIN")
                             .pathMatchers(HttpMethod.GET, "/course/**").authenticated();

                    // --- Enrollment Service ---
                    // Enrollments created by STUDENT or ADMIN; modifications/deletions restricted to ADMIN
                    exchanges.pathMatchers(HttpMethod.POST, "/enrollment/**").hasAnyRole("ADMIN", "STUDENT")
                             .pathMatchers(HttpMethod.PUT, "/enrollment/**").hasRole("ADMIN")
                             .pathMatchers(HttpMethod.DELETE, "/enrollment/**").hasRole("ADMIN")
                             .pathMatchers(HttpMethod.GET, "/enrollment/**").authenticated();

                    // --- Student Service ---
                    // Registration by ADMIN; Profile updates by STUDENT or ADMIN; deletions by ADMIN
                    exchanges.pathMatchers(HttpMethod.POST, "/student/**").hasRole("ADMIN")
                             .pathMatchers(HttpMethod.PUT, "/student/**").hasAnyRole("ADMIN", "STUDENT")
                             .pathMatchers(HttpMethod.DELETE, "/student/**").hasRole("ADMIN")
                             .pathMatchers(HttpMethod.GET, "/student/**").authenticated();

                    // 6. Catch-all: Any other exchange requires authentication
                    exchanges.anyExchange().authenticated();
                })
                .oauth2ResourceServer(oauth2 -> oauth2
                        .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter()))
                )
                .build();
    }

    @Bean
    public Converter<Jwt, Mono<AbstractAuthenticationToken>> jwtAuthenticationConverter() {
        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(new GrantedAuthoritiesExtractor(clientId));
        return new ReactiveJwtAuthenticationConverterAdapter(converter);
    }

    @Bean
    @ConditionalOnMissingBean(ReactiveJwtDecoder.class)
    public ReactiveJwtDecoder reactiveJwtDecoder(
            @Value("${spring.security.oauth2.resourceserver.jwt.issuer-uri:}") String issuerUri,
            @Value("${spring.security.oauth2.resourceserver.jwt.jwk-set-uri:}") String jwkSetUri,
            @Value("${gateway.security.audience:${gateway.security.client-id:api-gateway}}") String expectedAudience) {

        NimbusReactiveJwtDecoder decoder;
        if (StringUtils.hasText(jwkSetUri)) {
            decoder = NimbusReactiveJwtDecoder.withJwkSetUri(jwkSetUri).build();
        } else if (StringUtils.hasText(issuerUri)) {
            decoder = NimbusReactiveJwtDecoder.withIssuerLocation(issuerUri).build();
        } else {
            decoder = NimbusReactiveJwtDecoder.withJwkSetUri("http://localhost:8080/realms/gl5/protocol/openid-connect/certs").build();
        }

        OAuth2TokenValidator<Jwt> defaultValidator = StringUtils.hasText(issuerUri)
                ? JwtValidators.createDefaultWithIssuer(issuerUri)
                : JwtValidators.createDefault();

        OAuth2TokenValidator<Jwt> audienceValidator = new AudienceValidator(expectedAudience);
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(defaultValidator, audienceValidator));
        return decoder;
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOriginPatterns(allowedOrigins);
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setExposedHeaders(List.of("Authorization", "Link", "X-Total-Count"));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}

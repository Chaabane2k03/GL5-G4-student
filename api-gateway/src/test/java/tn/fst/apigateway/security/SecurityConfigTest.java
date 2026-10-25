package tn.fst.apigateway.security;

import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.NimbusReactiveJwtDecoder;
import org.springframework.security.oauth2.jwt.ReactiveJwtDecoder;

import static org.assertj.core.api.Assertions.assertThat;

class SecurityConfigTest {

    private final SecurityConfig securityConfig = new SecurityConfig();

    @Test
    void usesTheJwkSetUriWhenBothUrisAreConfigured() {
        ReactiveJwtDecoder decoder = securityConfig.reactiveJwtDecoder(
                "http://issuer.example/realms/gl5", "http://keys.example/certs", "api-gateway");

        assertThat(decoder).isInstanceOf(NimbusReactiveJwtDecoder.class);
    }

    @Test
    void usesTheIssuerLocationWhenOnlyTheIssuerIsConfigured() {
        ReactiveJwtDecoder decoder = securityConfig.reactiveJwtDecoder(
                "http://issuer.example/realms/gl5", "", "api-gateway");

        assertThat(decoder).isInstanceOf(NimbusReactiveJwtDecoder.class);
    }

    @Test
    void fallsBackToTheLocalKeycloakWhenNoUriIsConfigured() {
        ReactiveJwtDecoder decoder = securityConfig.reactiveJwtDecoder("", "", "api-gateway");

        assertThat(decoder).isInstanceOf(NimbusReactiveJwtDecoder.class);
    }
}

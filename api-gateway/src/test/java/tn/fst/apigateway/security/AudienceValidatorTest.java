package tn.fst.apigateway.security;

import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2ErrorCodes;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class AudienceValidatorTest {

    private static Jwt jwtWithAudience(List<String> audience) {
        return Jwt.withTokenValue("token")
                .header("alg", "none")
                .claim("aud", audience)
                .build();
    }

    @Test
    void acceptsEverythingWhenExpectedAudienceIsNull() {
        OAuth2TokenValidatorResult result =
                new AudienceValidator(null).validate(jwtWithAudience(List.of("anything")));

        assertThat(result.hasErrors()).isFalse();
    }

    @Test
    void acceptsEverythingWhenExpectedAudienceIsBlank() {
        OAuth2TokenValidatorResult result =
                new AudienceValidator("   ").validate(jwtWithAudience(List.of("anything")));

        assertThat(result.hasErrors()).isFalse();
    }

    @Test
    void acceptsEverythingWhenWildcardAudienceIsConfigured() {
        OAuth2TokenValidatorResult result =
                new AudienceValidator("*").validate(jwtWithAudience(List.of("anything")));

        assertThat(result.hasErrors()).isFalse();
    }

    @Test
    void acceptsTokenContainingTheExpectedAudience() {
        OAuth2TokenValidatorResult result =
                new AudienceValidator("api-gateway").validate(jwtWithAudience(List.of("api-gateway")));

        assertThat(result.hasErrors()).isFalse();
    }

    @Test
    void rejectsTokenWithoutTheExpectedAudience() {
        OAuth2TokenValidatorResult result =
                new AudienceValidator("api-gateway").validate(jwtWithAudience(List.of("other-client")));

        assertThat(result.hasErrors()).isTrue();
        assertThat(result.getErrors()).hasSize(1);
        OAuth2Error error = result.getErrors().iterator().next();
        assertThat(error.getErrorCode()).isEqualTo(OAuth2ErrorCodes.INVALID_TOKEN);
        assertThat(error.getDescription()).contains("api-gateway");
    }

    @Test
    void rejectsTokenWithNoAudienceClaim() {
        OAuth2TokenValidatorResult result =
                new AudienceValidator("api-gateway").validate(jwtWithAudience(List.of()));

        assertThat(result.hasErrors()).isTrue();
    }
}

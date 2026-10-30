package tn.fst.apigateway.security;

import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2ErrorCodes;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;

/**
 * Validates that the JWT access token contains the expected audience ('aud' claim).
 * This prevents cross-client token reuse where a valid token minted for another
 * client in the same realm is mistakenly accepted by the API Gateway.
 */
public class AudienceValidator implements OAuth2TokenValidator<Jwt> {

    private final String expectedAudience;

    public AudienceValidator(String expectedAudience) {
        this.expectedAudience = expectedAudience;
    }

    @Override
    public OAuth2TokenValidatorResult validate(Jwt jwt) {
        if (expectedAudience == null || expectedAudience.isBlank() || "*".equals(expectedAudience)) {
            return OAuth2TokenValidatorResult.success();
        }

        if (jwt.getAudience().contains(expectedAudience)) {
            return OAuth2TokenValidatorResult.success();
        }

        OAuth2Error error = new OAuth2Error(
                OAuth2ErrorCodes.INVALID_TOKEN,
                "The required audience '" + expectedAudience + "' is missing from the token's 'aud' claim",
                "https://tools.ietf.org/html/rfc6750#section-3.1"
        );
        return OAuth2TokenValidatorResult.failure(error);
    }
}


package tn.fst.apigateway.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * OpenAPI metadata for the API Gateway itself. Includes the OAuth2 Bearer security
 * scheme so users can authenticate directly within Swagger UI to test secured routes.
 */
@Configuration
public class OpenApiConfig {

    public static final String BEARER_SECURITY_SCHEME = "BearerAuth";

    @Bean
    public OpenAPI apiGatewayOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("API Gateway")
                        .version("v1")
                        .description("Single entry point for the GL5-G4 student management platform. "
                                + "Secured with OAuth2 / JWT. Use the Authorize button to enter a Bearer token."))
                .addSecurityItem(new SecurityRequirement().addList(BEARER_SECURITY_SCHEME))
                .components(new Components()
                        .addSecuritySchemes(BEARER_SECURITY_SCHEME, new SecurityScheme()
                                .name(BEARER_SECURITY_SCHEME)
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")
                                .description("Enter an OAuth2 JWT Bearer token (e.g. from Keycloak) to authenticate requests.")));
    }
}

package tn.fst.apigateway.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * OpenAPI metadata for the API Gateway itself. The gateway exposes no business
 * endpoints, so the useful documentation is the aggregated Swagger UI configured
 * through {@code springdoc.swagger-ui.urls.*} (see application.properties), which
 * lists the OpenAPI document of every routed backend service.
 */
@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI apiGatewayOpenAPI() {
        return new OpenAPI().info(new Info()
                .title("API Gateway")
                .version("v1")
                .description("Single entry point for the GL5-G4 student management platform. "
                        + "Backend services are exposed under their context path: /department, "
                        + "/course, /enrollment and /student. Use the definition selector in "
                        + "Swagger UI to browse each service's own API."));
    }
}

package com.eduplatform.course.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * OpenAPI metadata for the Course Service, sourced from the {@code app.openapi.*} properties
 * (overridable via environment variables). Swagger UI is served at {@code /swagger-ui.html}
 * and the spec at {@code /v3/api-docs} (both configurable too).
 */
@Configuration
public class OpenApiConfig {

    private final String title;
    private final String version;
    private final String description;

    public OpenApiConfig(
            @Value("${app.openapi.title:Course Service API}") String title,
            @Value("${app.openapi.version:v1}") String version,
            @Value("${app.openapi.description:}") String description) {
        this.title = title;
        this.version = version;
        this.description = description;
    }

    @Bean
    public OpenAPI courseServiceOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title(title)
                        .version(version)
                        .description(description));
    }
}

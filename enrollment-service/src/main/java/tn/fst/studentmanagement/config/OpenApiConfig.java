package tn.fst.studentmanagement.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * OpenAPI metadata for the Enrollment Service, aligned with the other services so the
 * gateway's aggregated Swagger UI shows a consistent title for every definition.
 */
@Configuration
public class OpenApiConfig {

    private final String title;
    private final String version;
    private final String description;

    public OpenApiConfig(
            @Value("${app.openapi.title:Enrollment Service API}") String title,
            @Value("${app.openapi.version:v1}") String version,
            @Value("${app.openapi.description:Command/query (CQRS) API for enrollments, including Axon-based endpoints.}") String description) {
        this.title = title;
        this.version = version;
        this.description = description;
    }

    @Bean
    public OpenAPI enrollmentServiceOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title(title)
                        .version(version)
                        .description(description));
    }
}

package tn.fst.apigateway.config;

import org.springdoc.core.properties.AbstractSwaggerUiConfigProperties.SwaggerUrl;
import org.springdoc.core.properties.SwaggerUiConfigProperties;
import org.springframework.context.annotation.Configuration;

import java.util.LinkedHashSet;
import java.util.Set;

/**
 * Makes the aggregated Swagger UI list every API, whatever the Config Server serves.
 *
 * <p>The Config Server's property sources outrank the jar's application.properties, so an
 * older copy of {@code api-gateway[-docker].properties} in the config repo would otherwise
 * silently reduce the selector to four entries. Setting the definitions here runs after
 * property binding and keeps the UI consistent with the routes declared in this service.
 */
@Configuration
public class SwaggerUiConfiguration {

    public SwaggerUiConfiguration(SwaggerUiConfigProperties swaggerUiConfig) {
        Set<SwaggerUrl> urls = new LinkedHashSet<>();
        urls.add(new SwaggerUrl("API Gateway", "/v3/api-docs", "API Gateway"));
        urls.add(new SwaggerUrl("Course Service", "/course/v3/api-docs", "Course Service"));
        urls.add(new SwaggerUrl("Department Service", "/department/v3/api-docs", "Department Service"));
        urls.add(new SwaggerUrl("Enrollment Service", "/enrollment/v3/api-docs", "Enrollment Service"));
        urls.add(new SwaggerUrl("Student Service", "/student/v3/api-docs", "Student Service"));
        swaggerUiConfig.setUrls(urls);
    }
}

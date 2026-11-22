package tn.fst.apigateway;

import io.swagger.v3.oas.models.OpenAPI;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;
import org.springframework.cloud.gateway.route.RouteDefinition;
import org.springframework.cloud.gateway.route.RouteDefinitionLocator;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Verifies the routing table the gateway is configured with: which paths are
 * matched, where they are forwarded (through Eureka), that the Eureka auto-locator
 * stays disabled and that the OpenAPI metadata / aggregated Swagger URLs are exposed.
 */
@SpringBootTest
@ActiveProfiles("test")
@org.springframework.context.annotation.Import(TestSecurityConfig.class)
class GatewayRouteConfigurationTest {

    private static final Map<String, String> EXPECTED_ROUTES = Map.of(
            "department-service", "/department/**",
            "course-service", "/course/**",
            "enrollment-service", "/enrollment/**",
            "student-service", "/student/**");
    // springdoc sorts the definitions by name in the UI, so the gateway's own spec comes first.
    private static final List<String> SWAGGER_DEFINITION_NAMES =
            List.of("API Gateway", "Course Service", "Department Service",
                    "Enrollment Service", "Student Service");
    private static final List<String> SWAGGER_DEFINITION_URLS =
            List.of("/v3/api-docs", "/course/v3/api-docs", "/department/v3/api-docs",
                    "/enrollment/v3/api-docs", "/student/v3/api-docs");

    @Autowired
    private RouteDefinitionLocator routeDefinitionLocator;

    @Autowired
    private Environment environment;

    @Autowired
    private OpenAPI openAPI;

    @Test
    void declaresOneLoadBalancedRoutePerBackendService() {
        List<RouteDefinition> definitions = routeDefinitionLocator.getRouteDefinitions().collectList().block();

        assertThat(definitions).hasSize(EXPECTED_ROUTES.size());
        for (RouteDefinition definition : definitions) {
            assertThat(EXPECTED_ROUTES).containsKey(definition.getId());
            assertThat(definition.getUri()).hasToString("lb://" + definition.getId());
            assertThat(definition.getPredicates()).singleElement().satisfies(predicate -> {
                assertThat(predicate.getName()).isEqualTo("Path");
                assertThat(predicate.getArgs()).containsValue(EXPECTED_ROUTES.get(definition.getId()));
            });
        }
    }

    @Test
    void keepsTheEurekaAutoLocatorDisabled() {
        assertThat(environment.getProperty(
                "spring.cloud.gateway.server.webflux.discovery.locator.enabled", Boolean.class)).isFalse();
    }

    @Test
    void appliesPreserveHostHeaderToEveryRoute() {
        assertThat(environment.getProperty(
                "spring.cloud.gateway.server.webflux.default-filters[0]")).isEqualTo("PreserveHostHeader");
    }

    @Test
    void exposesItsOwnOpenApiMetadata() {
        assertThat(openAPI.getInfo().getTitle()).isEqualTo("API Gateway");
        assertThat(openAPI.getInfo().getVersion()).isEqualTo("v1");
    }

    @Test
    void aggregatesEveryBackendOpenApiDocumentInSwaggerUi() {
        assertThat(environment.getProperty("springdoc.swagger-ui.path")).isEqualTo("/swagger-ui.html");
        assertThat(environment.getProperty("springdoc.swagger-ui.tagsSorter")).isEqualTo("alpha");
        assertThat(environment.getProperty("springdoc.swagger-ui.operationsSorter")).isEqualTo("alpha");
        assertThat(environment.getProperty("springdoc.swagger-ui.docExpansion")).isEqualTo("none");
        for (int index = 0; index < SWAGGER_DEFINITION_URLS.size(); index++) {
            String name = environment.getProperty(
                    "springdoc.swagger-ui.urls[" + index + "].name");
            String url = environment.getProperty(
                    "springdoc.swagger-ui.urls[" + index + "].url");
            assertThat(name).isEqualTo(SWAGGER_DEFINITION_NAMES.get(index));
            assertThat(url).isEqualTo(SWAGGER_DEFINITION_URLS.get(index));
        }
    }
}

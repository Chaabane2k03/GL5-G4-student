package tn.fst.apigateway;

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
 * Verifies the {@code kubernetes} profile: routes resolve to direct in-cluster
 * Service URLs (Kubernetes DNS) instead of {@code lb://} via Eureka, and neither
 * the Eureka client nor the Config Server client is active, so the gateway runs
 * without the discovery/config infrastructure.
 */
@SpringBootTest
@ActiveProfiles({"kubernetes", "test"})
@org.springframework.context.annotation.Import(TestSecurityConfig.class)
class GatewayKubernetesProfileTest {

    private static final Map<String, String> EXPECTED_URI_BY_ROUTE = Map.of(
            "department-service", "http://department-service",
            "course-service", "http://course-service",
            "enrollment-service", "http://enrollment-service",
            "student-service", "http://student-service");

    @Autowired
    private RouteDefinitionLocator routeDefinitionLocator;

    @Autowired
    private Environment environment;

    @Test
    void routesTargetInClusterServicesInsteadOfEureka() {
        List<RouteDefinition> definitions = routeDefinitionLocator.getRouteDefinitions().collectList().block();

        assertThat(definitions).hasSize(EXPECTED_URI_BY_ROUTE.size());
        for (RouteDefinition definition : definitions) {
            assertThat(EXPECTED_URI_BY_ROUTE).containsKey(definition.getId());
            assertThat(definition.getUri()).hasToString(EXPECTED_URI_BY_ROUTE.get(definition.getId()));
        }
    }

    @Test
    void disablesEurekaAndConfigServerClients() {
        assertThat(environment.getProperty("eureka.client.enabled", Boolean.class)).isFalse();
        assertThat(environment.getProperty("spring.cloud.config.enabled", Boolean.class)).isFalse();
    }

    @Test
    void keepsServiceUrlsAndProbesOverridableThroughConfiguration() {
        assertThat(environment.getProperty("department.service.url")).isEqualTo("http://department-service");
        assertThat(environment.getProperty("student.service.url")).isEqualTo("http://student-service");
        assertThat(environment.getProperty("management.endpoint.health.probes.enabled", Boolean.class)).isTrue();
    }
}

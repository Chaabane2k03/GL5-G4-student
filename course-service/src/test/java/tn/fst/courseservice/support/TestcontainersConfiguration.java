package tn.fst.courseservice.support;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.testcontainers.containers.MySQLContainer;

/**
 * Exposes the shared {@link MySqlTestContainer} as a {@code @ServiceConnection} so Spring Boot
 * wires the datasource automatically. Import it explicitly in DB-backed tests
 * ({@code @Import(TestcontainersConfiguration.class)}); being a {@code @TestConfiguration},
 * it is excluded from component scanning.
 */
@TestConfiguration(proxyBeanMethods = false)
public class TestcontainersConfiguration {

    @Bean
    @ServiceConnection
    MySQLContainer<?> mysqlContainer() {
        return MySqlTestContainer.INSTANCE;
    }
}

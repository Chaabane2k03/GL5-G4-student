package tn.fst.configserver;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.stream.Stream;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.startupcheck.OneShotStartupCheckStrategy;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import tn.fst.configserver.support.GitDaemonContainer;
import tn.fst.configserver.support.TestConfigRepository;
import tn.fst.tempclient.TemporaryClientApplication;

@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
class ConfigServerIntegrationTest {

    private static final String USER = "config-user";
    private static final String PASSWORD = "config-secret";
    private static final String ENCRYPT_KEY = "integration-test-encryption-key";

    @Container
    static final GitDaemonContainer GIT = new GitDaemonContainer(TestConfigRepository.createRepositoryRoot());

    @DynamicPropertySource
    static void configServerProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.cloud.config.server.git.uri", GIT::repositoryUri);
        registry.add("spring.cloud.config.server.git.default-label", () -> "main");
        registry.add("spring.cloud.config.server.git.clone-on-start", () -> true);
        registry.add("spring.cloud.config.server.git.force-pull", () -> true);
        registry.add("encrypt.key", () -> ENCRYPT_KEY);
        registry.add("spring.security.user.name", () -> USER);
        registry.add("spring.security.user.password", () -> PASSWORD);
    }

    @Autowired
    TestRestTemplate restTemplate;

    @Autowired
    MockMvc mockMvc;

    @LocalServerPort
    int port;

    private TestRestTemplate authenticated() {
        return restTemplate.withBasicAuth(USER, PASSWORD);
    }

    @Test
    void healthEndpointRequiresAuthentication() {
        ResponseEntity<String> response = restTemplate.getForEntity("/actuator/health", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void healthEndpointIsUpWhenAuthenticated() {
        ResponseEntity<String> response = authenticated().getForEntity("/actuator/health", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("\"status\":\"UP\"");
    }

    @Test
    void configEndpointRequiresAuthentication() {
        ResponseEntity<String> response = restTemplate.getForEntity("/student-service/dev", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void encryptEndpointRejectsAuthenticatedRequestWithoutCsrfToken() throws Exception {
        mockMvc.perform(post("/encrypt")
                        .with(httpBasic(USER, PASSWORD))
                        .contentType(MediaType.TEXT_PLAIN)
                        .content("top-secret"))
                .andExpect(status().isForbidden());
    }

    static Stream<Arguments> serviceProfiles() {
        return Stream.of(
                Arguments.of("student-service", "dev", "jdbc:mysql://localhost:3306/studentdb_dev"),
                Arguments.of("student-service", "prod", "jdbc:mysql://localhost:3306/studentdb?useSSL=true"),
                Arguments.of("department-service", "dev", "jdbc:mysql://localhost:3306/departmentdb_dev"),
                Arguments.of("department-service", "prod", "jdbc:mysql://localhost:3306/departmentdb?useSSL=true"),
                Arguments.of("enrollment-service", "dev", "jdbc:mysql://localhost:3306/enrollmentdb_dev"),
                Arguments.of("enrollment-service", "prod", "jdbc:mysql://localhost:3306/enrollmentdb?useSSL=true"),
                Arguments.of("course-service", "dev", "jdbc:mysql://localhost:3306/coursedb_dev"),
                Arguments.of("course-service", "prod", "jdbc:mysql://localhost:3306/coursedb?useSSL=true"));
    }

    @ParameterizedTest(name = "{0} [{1}] is served from the Git repository")
    @MethodSource("serviceProfiles")
    void servesProfileSpecificConfiguration(String application, String profile, String expectedDatasource) {
        ResponseEntity<String> response = authenticated()
                .getForEntity("/{app}/{profile}", String.class, application, profile);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody())
                .contains("\"name\":\"" + application + "\"")
                .contains("\"" + profile + "\"")
                .contains(application + "-" + profile + ".properties")
                .contains(expectedDatasource);
    }

    @Test
    void servesBaseConfigurationForDefaultProfile() {
        ResponseEntity<String> response = authenticated()
                .getForEntity("/student-service/default", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody())
                .contains("student-service.properties")
                .contains("server.port")
                .contains("8085");
    }

    @Test
    void unknownLabelIsNotFound() {
        ResponseEntity<String> response = authenticated()
                .getForEntity("/student-service/dev/does-not-exist", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void encryptsAndDecryptsValuesWithCsrfTokens() throws Exception {
        String encrypted = mockMvc.perform(post("/encrypt")
                        .with(httpBasic(USER, PASSWORD))
                        .with(csrf())
                        .contentType(MediaType.TEXT_PLAIN)
                        .content("top-secret"))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        assertThat(encrypted).isNotBlank();

        mockMvc.perform(post("/decrypt")
                        .with(httpBasic(USER, PASSWORD))
                        .with(csrf())
                                .contentType(MediaType.TEXT_PLAIN)
                                .content(encrypted))
                        .andExpect(status().isOk())
                        .andExpect(content().string("top-secret"));
    }

    @Test
    void temporaryClientServiceResolvesItsConfigurationFromTheServer() {
        ConfigurableApplicationContext client = new SpringApplicationBuilder(TemporaryClientApplication.class)
                .run("--spring.application.name=student-service",
                        "--spring.profiles.active=dev",
                        "--spring.config.import=configserver:http://localhost:" + port,
                        "--spring.cloud.config.enabled=true",
                        "--spring.cloud.config.username=" + USER,
                        "--spring.cloud.config.password=" + PASSWORD,
                        "--spring.cloud.config.fail-fast=true",
                        "--server.port=0",
                        "--server.servlet.context-path=",
                        "--spring.security.user.name=" + USER,
                        "--spring.security.user.password=" + PASSWORD,
                        "--encrypt.key=" + ENCRYPT_KEY);
        try {
            String clientPort = client.getEnvironment().getProperty("local.server.port");
            ResponseEntity<String> response = restTemplate
                    .getForEntity("http://localhost:" + clientPort + "/info", String.class);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody())
                    .contains("student-service")
                    .contains("studentdb_dev");
        }
        finally {
            client.close();
        }
    }

    @Test
    void containerizedTemporaryClientCanFetchConfiguration() {
        org.testcontainers.Testcontainers.exposeHostPorts(port);
        try (GenericContainer<?> client = new GenericContainer<>(
                DockerImageName.parse("curlimages/curl:8.10.1"))) {
            client.withStartupCheckStrategy(new OneShotStartupCheckStrategy());
            client.withCommand("--silent", "--fail", "--user", USER + ":" + PASSWORD,
                    "http://host.testcontainers.internal:" + port + "/student-service/dev");
            client.start();

            assertThat(client.getLogs()).contains("studentdb_dev");
        }
    }
}

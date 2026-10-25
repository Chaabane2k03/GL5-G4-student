package tn.fst.apigateway;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mockStatic;

import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.springframework.boot.SpringApplication;

class ApiGatewayApplicationMainTest {

    @Test
    void applicationCanBeInstantiated() {
        assertThat(new ApiGatewayApplication()).isNotNull();
    }

    @Test
    void mainDelegatesToSpringApplication() {
        String[] args = {"--spring.main.web-application-type=none"};

        try (MockedStatic<SpringApplication> springApplication = mockStatic(SpringApplication.class)) {
            ApiGatewayApplication.main(args);

            springApplication.verify(() -> SpringApplication.run(ApiGatewayApplication.class, args));
        }
    }
}

package tn.fst.configserver;

import static org.mockito.Mockito.mockStatic;

import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.springframework.boot.SpringApplication;

class ConfigServerApplicationTest {

    @Test
    void mainDelegatesToSpringApplication() {
        String[] args = {"--spring.main.web-application-type=none"};

        try (MockedStatic<SpringApplication> springApplication = mockStatic(SpringApplication.class)) {
            ConfigServerApplication.main(args);

            springApplication.verify(() -> SpringApplication.run(ConfigServerApplication.class, args));
        }
    }
}

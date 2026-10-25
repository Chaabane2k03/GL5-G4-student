package tn.fst.eureka;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mockStatic;

import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.springframework.boot.SpringApplication;

class EurekaServerApplicationTest {

    @Test
    void applicationCanBeInstantiated() {
        assertThat(new EurekaServerApplication()).isNotNull();
    }

    @Test
    void mainDelegatesToSpringApplication() {
        String[] args = {"--spring.main.web-application-type=none"};

        try (MockedStatic<SpringApplication> springApplication = mockStatic(SpringApplication.class)) {
            EurekaServerApplication.main(args);

            springApplication.verify(() -> SpringApplication.run(EurekaServerApplication.class, args));
        }
    }
}

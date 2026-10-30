package tn.fst.departmentservice;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mockStatic;

import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.springframework.boot.SpringApplication;

class DepartmentServiceApplicationTest {

    @Test
    void applicationCanBeInstantiated() {
        assertThat(new DepartmentServiceApplication()).isNotNull();
    }

    @Test
    void mainDelegatesToSpringApplication() {
        String[] args = {"--spring.main.web-application-type=none"};

        try (MockedStatic<SpringApplication> springApplication = mockStatic(SpringApplication.class)) {
            DepartmentServiceApplication.main(args);

            springApplication.verify(() -> SpringApplication.run(DepartmentServiceApplication.class, args));
        }
    }
}

package tn.fst.studentmanagement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mockStatic;

import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.springframework.boot.SpringApplication;

class StudentManagementApplicationTest {

    @Test
    void applicationCanBeInstantiated() {
        assertThat(new StudentManagementApplication()).isNotNull();
    }

    @Test
    void mainDelegatesToSpringApplication() {
        String[] args = {"--spring.main.web-application-type=none"};

        try (MockedStatic<SpringApplication> springApplication = mockStatic(SpringApplication.class)) {
            StudentManagementApplication.main(args);

            springApplication.verify(() -> SpringApplication.run(StudentManagementApplication.class, args));
        }
    }
}

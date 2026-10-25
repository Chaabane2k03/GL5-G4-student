package tn.fst.studentmanagement.exceptions;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;

import static org.assertj.core.api.Assertions.assertThat;

class EnrollmentExceptionHandlerTest {

    private final EnrollmentExceptionHandler handler = new EnrollmentExceptionHandler();

    @Test
    void studentNotFoundBecomes404ProblemDetail() {
        ProblemDetail problem = handler.handleStudentNotFound(new StudentNotFoundException(1L));

        assertThat(problem.getStatus()).isEqualTo(HttpStatus.NOT_FOUND.value());
        assertThat(problem.getDetail()).contains("Student with ID 1");
    }

    @Test
    void courseNotFoundBecomes404ProblemDetail() {
        ProblemDetail problem = handler.handleCourseNotFound(new CourseNotFoundException(2L));

        assertThat(problem.getStatus()).isEqualTo(HttpStatus.NOT_FOUND.value());
        assertThat(problem.getDetail()).contains("Course with ID 2");
    }

    @Test
    void enrollmentNotFoundBecomes404ProblemDetail() {
        ProblemDetail problem = handler.handleEnrollmentNotFound(new EnrollmentNotFoundException(3L));

        assertThat(problem.getStatus()).isEqualTo(HttpStatus.NOT_FOUND.value());
        assertThat(problem.getDetail()).contains("Enrollment with ID 3");
    }
}

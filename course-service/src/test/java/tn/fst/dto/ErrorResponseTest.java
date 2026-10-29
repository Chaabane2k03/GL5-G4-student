package tn.fst.course.dto;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ErrorResponseTest {

    @Test
    void ofWithFieldErrorsShouldCarryTimestampAndDetails() {
        ErrorResponse response = ErrorResponse.of(400, "Bad Request", "Validation failed", "/api/courses",
                List.of(new ErrorResponse.FieldErrorItem("code", "must not be blank")));

        assertThat(response.timestamp()).isNotNull();
        assertThat(response.status()).isEqualTo(400);
        assertThat(response.error()).isEqualTo("Bad Request");
        assertThat(response.message()).isEqualTo("Validation failed");
        assertThat(response.path()).isEqualTo("/api/courses");
        assertThat(response.fieldErrors()).hasSize(1);
        assertThat(response.fieldErrors().get(0).field()).isEqualTo("code");
        assertThat(response.fieldErrors().get(0).message()).isEqualTo("must not be blank");
    }

    @Test
    void ofWithoutFieldErrorsShouldDefaultToEmptyList() {
        ErrorResponse response = ErrorResponse.of(404, "Not Found", "missing", "/api/courses/1");

        assertThat(response.status()).isEqualTo(404);
        assertThat(response.fieldErrors()).isEmpty();
    }
}

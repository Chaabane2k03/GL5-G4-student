package tn.fst.course.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

/**
 * Payload for creating and updating a course.
 *
 * <p>Deliberately carries no {@code status}: status is managed by the service
 * (created courses start {@code ACTIVE}; update/archive/activate own the transitions).</p>
 */
@Schema(description = "Payload for creating or updating a course")
public record CourseRequest(

        @Schema(description = "Unique course code; trimmed and uppercased by the service",
                example = "CS101", maxLength = 20, requiredMode = Schema.RequiredMode.REQUIRED)
        @NotBlank(message = "code must not be blank")
        @Size(max = 20, message = "code must be at most 20 characters")
        String code,

        @Schema(description = "Course title", example = "Introduction to Computer Science",
                maxLength = 150, requiredMode = Schema.RequiredMode.REQUIRED)
        @NotBlank(message = "title must not be blank")
        @Size(max = 150, message = "title must be at most 150 characters")
        String title,

        @Schema(description = "Optional free-form description", example = "Foundations of computing")
        String description,

        @Schema(description = "Number of credits (1-30)", example = "6",
                minimum = "1", maximum = "30", requiredMode = Schema.RequiredMode.REQUIRED)
        @NotNull(message = "credits must not be null")
        @Min(value = 1, message = "credits must be at least 1")
        @Max(value = 30, message = "credits must be at most 30")
        Integer credits,

        @Schema(description = "Id of the owning department (referenced by id only)", example = "1",
                requiredMode = Schema.RequiredMode.REQUIRED)
        @NotNull(message = "departmentId must not be null")
        @Positive(message = "departmentId must be positive")
        Long departmentId
) {
}

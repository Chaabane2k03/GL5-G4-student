package com.eduplatform.course.dto;

import com.eduplatform.course.entity.CourseStatus;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

/**
 * Representation of a course returned by the API. Controllers never expose the entity directly.
 */
@Schema(description = "A course as returned by the API")
public record CourseResponse(
        @Schema(description = "Surrogate id", example = "1") Long id,
        @Schema(description = "Unique course code", example = "CS101") String code,
        @Schema(description = "Course title", example = "Introduction to Computer Science") String title,
        @Schema(description = "Free-form description") String description,
        @Schema(description = "Number of credits", example = "6") Integer credits,
        @Schema(description = "Owning department id", example = "1") Long departmentId,
        @Schema(description = "Current status", example = "ACTIVE") CourseStatus status,
        @Schema(description = "Creation timestamp (UTC)") LocalDateTime createdAt,
        @Schema(description = "Last update timestamp (UTC)") LocalDateTime updatedAt
) {
}

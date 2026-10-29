package tn.fst.course.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Read-only view of a department owned by the department-service. Only the fields needed
 * by the course flow are mapped; unknown JSON properties are ignored by Jackson.
 */
@Schema(description = "A department as returned by the department-service")
public record DepartmentDto(
        @Schema(description = "Department id", example = "1") Long idDepartment,
        @Schema(description = "Department name", example = "Computer Science") String name,
        @Schema(description = "Location", example = "Building A") String location,
        @Schema(description = "Contact phone", example = "123") String phone,
        @Schema(description = "Head of department", example = "A. Smith") String head) {
}

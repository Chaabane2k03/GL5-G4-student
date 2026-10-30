package tn.fst.studentmanagement.dto;

/**
 * Read-only view of a course owned by the course-service. Only the fields needed by the
 * enrollment flow are mapped; unknown JSON properties are ignored by Jackson.
 */
public record CourseDto(
        Long id,
        String code,
        String title,
        String description,
        Integer credits,
        Long departmentId,
        String status) {
}

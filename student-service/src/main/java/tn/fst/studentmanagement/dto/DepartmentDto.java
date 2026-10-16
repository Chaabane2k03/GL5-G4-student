package tn.fst.studentmanagement.dto;

/**
 * Read-only view of a department owned by the department-service. Only the fields needed
 * by the student flow are mapped; unknown JSON properties are ignored by Jackson.
 */
public record DepartmentDto(
        Long idDepartment,
        String name,
        String location,
        String phone,
        String head) {
}

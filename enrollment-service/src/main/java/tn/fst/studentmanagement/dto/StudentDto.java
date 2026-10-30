package tn.fst.studentmanagement.dto;

import java.time.LocalDate;

/**
 * Read-only view of a student owned by the student-service. Only the fields needed by the
 * enrollment flow are mapped; unknown JSON properties are ignored by Jackson.
 */
public record StudentDto(
        Long idStudent,
        String firstName,
        String lastName,
        String email,
        String phone,
        LocalDate dateOfBirth,
        String address,
        Long departmentId) {
}

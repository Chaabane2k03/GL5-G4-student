package tn.fst.studentmanagement.dto;

import tn.fst.studentmanagement.entities.Student;

import java.time.LocalDate;

/**
 * Write model for creating and updating a student.
 *
 * <p>Keeping the JPA entity out of the controller signature (Sonar S4684) avoids
 * binding request payloads straight onto a persistent object. The component names
 * match the {@link Student} entity so the existing JSON contract is unchanged.
 */
public record StudentRequest(
        Long idStudent,
        String firstName,
        String lastName,
        String email,
        String phone,
        LocalDate dateOfBirth,
        String address,
        Long departmentId) {

    public Student toEntity() {
        return new Student(
                idStudent,
                firstName,
                lastName,
                email,
                phone,
                dateOfBirth,
                address,
                departmentId);
    }
}

package tn.fst.studentmanagement.query;

import tn.fst.studentmanagement.entities.Enrollment;
import tn.fst.studentmanagement.entities.Status;

import java.time.LocalDate;

/** Read model returned by the query side. The JSON field names match the old entity. */
public record EnrollmentResponse(
        Long idEnrollment,
        LocalDate enrollmentDate,
        Double grade,
        Status status,
        Long studentId,
        Long courseId) {

    public static EnrollmentResponse from(Enrollment enrollment) {
        return new EnrollmentResponse(
                enrollment.getIdEnrollment(),
                enrollment.getEnrollmentDate(),
                enrollment.getGrade(),
                enrollment.getStatus(),
                enrollment.getStudentId(),
                enrollment.getCourseId());
    }
}
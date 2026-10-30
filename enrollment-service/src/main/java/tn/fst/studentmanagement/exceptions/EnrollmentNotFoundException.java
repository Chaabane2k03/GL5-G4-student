package tn.fst.studentmanagement.exceptions;

public class EnrollmentNotFoundException extends RuntimeException {

    public EnrollmentNotFoundException(Long idEnrollment) {
        super("Enrollment with ID " + idEnrollment + " was not found");
    }
}
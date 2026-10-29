package tn.fst.course.exception;

/**
 * Raised when the department-service cannot be reached, so the existence of a department
 * cannot be verified. Mapped to 503 (retryable) rather than a generic 500: the write is
 * refused on purpose, no course is persisted.
 */
public class DepartmentServiceUnavailableException extends RuntimeException {

    public DepartmentServiceUnavailableException(Long departmentId) {
        super("Department " + departmentId
                + " could not be verified because department-service is unavailable; please retry");
    }
}

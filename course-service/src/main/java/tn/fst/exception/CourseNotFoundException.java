package tn.fst.course.exception;

/**
 * Thrown when a course id does not resolve to an existing row. Mapped to HTTP 404.
 */
public class CourseNotFoundException extends RuntimeException {

    public CourseNotFoundException(Long id) {
        super("Course with id " + id + " was not found");
    }
}

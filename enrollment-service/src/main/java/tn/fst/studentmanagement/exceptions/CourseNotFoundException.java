package tn.fst.studentmanagement.exceptions;

public class CourseNotFoundException extends RuntimeException {

    public CourseNotFoundException(Long idCourse) {
        super("Course with ID " + idCourse + " was not found");
    }
}

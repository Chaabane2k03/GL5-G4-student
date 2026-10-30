package tn.fst.studentmanagement.exceptions;

public class StudentNotFoundException extends RuntimeException {

    public StudentNotFoundException(Long idStudent) {
        super("Student with ID " + idStudent + " was not found");
    }
}

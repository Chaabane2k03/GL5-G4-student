package tn.fst.studentmanagement.exceptions;

public class DepartmentNotFoundException extends RuntimeException {

    public DepartmentNotFoundException(Long idDepartment) {
        super("Department with ID " + idDepartment + " was not found");
    }
}

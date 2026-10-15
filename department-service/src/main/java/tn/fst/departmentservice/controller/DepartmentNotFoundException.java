package tn.fst.departmentservice.controller;

public class DepartmentNotFoundException extends RuntimeException {

    public DepartmentNotFoundException(Long id) {
        super("Department with ID " + id + " was not found");
    }
}

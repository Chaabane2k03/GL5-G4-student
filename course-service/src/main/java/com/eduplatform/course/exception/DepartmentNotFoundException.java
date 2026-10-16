package com.eduplatform.course.exception;

public class DepartmentNotFoundException extends RuntimeException {

    public DepartmentNotFoundException(Long departmentId) {
        super("Department with ID " + departmentId + " was not found");
    }
}

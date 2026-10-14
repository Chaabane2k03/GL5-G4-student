package com.eduplatform.course.exception;

/**
 * Thrown when a course code is already used by another course. Mapped to HTTP 409.
 */
public class DuplicateCourseCodeException extends RuntimeException {

    public DuplicateCourseCodeException(String code) {
        super("A course with code '" + code + "' already exists");
    }
}

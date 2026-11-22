package tn.fst.courseservice.cqrs;

public record CourseCreatedEvent(String courseId, String code, String title, String description,
                                 Integer credits, Long departmentId) {}

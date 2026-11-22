package tn.fst.courseservice.cqrs;

public record CourseUpdatedEvent(String courseId, String code, String title, String description,
                                 Integer credits, Long departmentId) {}

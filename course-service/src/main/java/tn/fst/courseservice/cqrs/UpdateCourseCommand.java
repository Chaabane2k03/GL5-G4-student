package tn.fst.courseservice.cqrs;

import org.axonframework.modelling.command.TargetAggregateIdentifier;

public record UpdateCourseCommand(@TargetAggregateIdentifier String courseId, String code, String title,
                                  String description, Integer credits, Long departmentId) {}

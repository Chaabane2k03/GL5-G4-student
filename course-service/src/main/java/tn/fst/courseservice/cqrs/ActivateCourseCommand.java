package tn.fst.courseservice.cqrs;

import org.axonframework.modelling.command.TargetAggregateIdentifier;

public record ActivateCourseCommand(@TargetAggregateIdentifier String courseId) {}

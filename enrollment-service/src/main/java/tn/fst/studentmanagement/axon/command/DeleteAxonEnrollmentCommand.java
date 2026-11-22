package tn.fst.studentmanagement.axon.command;

import org.axonframework.modelling.command.TargetAggregateIdentifier;

public record DeleteAxonEnrollmentCommand(@TargetAggregateIdentifier String enrollmentId) {
}

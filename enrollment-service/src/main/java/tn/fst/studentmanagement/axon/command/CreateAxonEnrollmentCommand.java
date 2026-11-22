package tn.fst.studentmanagement.axon.command;

import org.axonframework.modelling.command.TargetAggregateIdentifier;
import tn.fst.studentmanagement.entities.Status;

import java.time.LocalDate;

public record CreateAxonEnrollmentCommand(
        @TargetAggregateIdentifier String enrollmentId,
        LocalDate enrollmentDate,
        Double grade,
        Status status,
        Long studentId,
        Long courseId) {
}

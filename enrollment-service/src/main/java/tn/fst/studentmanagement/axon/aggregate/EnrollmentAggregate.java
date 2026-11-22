package tn.fst.studentmanagement.axon.aggregate;

import org.axonframework.commandhandling.CommandHandler;
import org.axonframework.eventsourcing.EventSourcingHandler;
import org.axonframework.modelling.command.AggregateIdentifier;
import org.axonframework.modelling.command.AggregateLifecycle;
import org.axonframework.spring.stereotype.Aggregate;
import tn.fst.studentmanagement.axon.command.CreateAxonEnrollmentCommand;
import tn.fst.studentmanagement.axon.command.DeleteAxonEnrollmentCommand;
import tn.fst.studentmanagement.axon.command.UpdateAxonEnrollmentCommand;
import tn.fst.studentmanagement.axon.event.AxonEnrollmentCreatedEvent;
import tn.fst.studentmanagement.axon.event.AxonEnrollmentDeletedEvent;
import tn.fst.studentmanagement.axon.event.AxonEnrollmentUpdatedEvent;
import tn.fst.studentmanagement.entities.Status;

import java.time.LocalDate;

@Aggregate
public class EnrollmentAggregate {

    @AggregateIdentifier
    private String enrollmentId;
    private boolean deleted;

    protected EnrollmentAggregate() {
    }

    @CommandHandler
    public EnrollmentAggregate(CreateAxonEnrollmentCommand command) {
        AggregateLifecycle.apply(new AxonEnrollmentCreatedEvent(
                command.enrollmentId(), command.enrollmentDate(), command.grade(),
                command.status(), command.studentId(), command.courseId()));
    }

    @CommandHandler
    public void handle(UpdateAxonEnrollmentCommand command) {
        if (!deleted) {
            AggregateLifecycle.apply(new AxonEnrollmentUpdatedEvent(
                    command.enrollmentId(), command.enrollmentDate(), command.grade(),
                    command.status(), command.studentId(), command.courseId()));
        }
    }

    @CommandHandler
    public void handle(DeleteAxonEnrollmentCommand command) {
        if (!deleted) {
            AggregateLifecycle.apply(new AxonEnrollmentDeletedEvent(command.enrollmentId()));
        }
    }

    @EventSourcingHandler
    public void on(AxonEnrollmentCreatedEvent event) {
        enrollmentId = event.enrollmentId();
        deleted = false;
    }

    @EventSourcingHandler
    public void on(AxonEnrollmentUpdatedEvent event) {
        enrollmentId = event.enrollmentId();
    }

    @EventSourcingHandler
    public void on(AxonEnrollmentDeletedEvent event) {
        deleted = true;
    }
}

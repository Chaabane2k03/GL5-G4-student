package tn.fst.studentmanagement.cqrs;

import org.axonframework.commandhandling.CommandHandler;
import org.axonframework.eventsourcing.EventSourcingHandler;
import org.axonframework.modelling.command.AggregateIdentifier;
import org.axonframework.modelling.command.AggregateLifecycle;
import org.axonframework.spring.stereotype.Aggregate;
import tn.fst.studentmanagement.cqrs.StudentCommandsAndEvents.*;

@Aggregate
public class StudentAggregate {
    @AggregateIdentifier
    private String studentId;

    protected StudentAggregate() {}

    @CommandHandler
    public StudentAggregate(CreateStudentCommand command) {
        AggregateLifecycle.apply(new StudentCreatedEvent(command.studentId(), command.firstName(),
                command.lastName(), command.email(), command.phone(), command.dateOfBirth(),
                command.address(), command.departmentId()));
    }

    @CommandHandler
    public void handle(UpdateStudentCommand command) {
        AggregateLifecycle.apply(new StudentUpdatedEvent(command.studentId(), command.firstName(),
                command.lastName(), command.email(), command.phone(), command.dateOfBirth(),
                command.address(), command.departmentId()));
    }

    @CommandHandler
    public void handle(DeleteStudentCommand command) {
        AggregateLifecycle.apply(new StudentDeletedEvent(command.studentId()));
    }

    @EventSourcingHandler
    public void on(StudentCreatedEvent event) { studentId = event.studentId(); }
    @EventSourcingHandler
    public void on(StudentUpdatedEvent event) { studentId = event.studentId(); }
    @EventSourcingHandler
    public void on(StudentDeletedEvent event) { studentId = event.studentId(); }
}

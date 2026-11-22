package tn.fst.departmentservice.cqrs;

import org.axonframework.commandhandling.CommandHandler;
import org.axonframework.eventsourcing.EventSourcingHandler;
import org.axonframework.modelling.command.AggregateIdentifier;
import org.axonframework.modelling.command.AggregateLifecycle;
import org.axonframework.spring.stereotype.Aggregate;
import tn.fst.departmentservice.cqrs.DepartmentCommandsAndEvents.*;

@Aggregate
public class DepartmentAggregate {
    @AggregateIdentifier
    private String departmentId;

    protected DepartmentAggregate() {}

    @CommandHandler
    public DepartmentAggregate(CreateDepartmentCommand command) {
        AggregateLifecycle.apply(new DepartmentCreatedEvent(command.departmentId(), command.name(),
                command.location(), command.phone(), command.head()));
    }

    @CommandHandler
    public void handle(UpdateDepartmentCommand command) {
        AggregateLifecycle.apply(new DepartmentUpdatedEvent(command.departmentId(), command.name(),
                command.location(), command.phone(), command.head()));
    }

    @CommandHandler
    public void handle(DeleteDepartmentCommand command) {
        AggregateLifecycle.apply(new DepartmentDeletedEvent(command.departmentId()));
    }

    @EventSourcingHandler public void on(DepartmentCreatedEvent event) { departmentId = event.departmentId(); }
    @EventSourcingHandler public void on(DepartmentUpdatedEvent event) { departmentId = event.departmentId(); }
    @EventSourcingHandler public void on(DepartmentDeletedEvent event) { departmentId = event.departmentId(); }
}

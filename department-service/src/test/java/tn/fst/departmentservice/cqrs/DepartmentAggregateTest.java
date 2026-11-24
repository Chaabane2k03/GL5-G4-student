package tn.fst.departmentservice.cqrs;

import org.axonframework.modelling.command.AggregateLifecycle;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import tn.fst.departmentservice.cqrs.DepartmentCommandsAndEvents.CreateDepartmentCommand;
import tn.fst.departmentservice.cqrs.DepartmentCommandsAndEvents.DeleteDepartmentCommand;
import tn.fst.departmentservice.cqrs.DepartmentCommandsAndEvents.DepartmentCreatedEvent;
import tn.fst.departmentservice.cqrs.DepartmentCommandsAndEvents.DepartmentDeletedEvent;
import tn.fst.departmentservice.cqrs.DepartmentCommandsAndEvents.DepartmentUpdatedEvent;
import tn.fst.departmentservice.cqrs.DepartmentCommandsAndEvents.FindAllDepartmentsQuery;
import tn.fst.departmentservice.cqrs.DepartmentCommandsAndEvents.FindDepartmentQuery;
import tn.fst.departmentservice.cqrs.DepartmentCommandsAndEvents.UpdateDepartmentCommand;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.times;

class DepartmentAggregateTest {

    @Test
    void appliesCommandsAsEventsAndReplaysThem() {
        CreateDepartmentCommand create = new CreateDepartmentCommand("1", "CS", "Building A", "123", "A. Smith");
        UpdateDepartmentCommand update = new UpdateDepartmentCommand("1", "SE", "Building B", "456", "B. Smith");
        DeleteDepartmentCommand delete = new DeleteDepartmentCommand("1");

        try (MockedStatic<AggregateLifecycle> lifecycle = mockStatic(AggregateLifecycle.class)) {
            DepartmentAggregate aggregate = new DepartmentAggregate(create);
            aggregate.handle(update);
            aggregate.handle(delete);

            ArgumentCaptor<Object> events = ArgumentCaptor.forClass(Object.class);
            lifecycle.verify(() -> AggregateLifecycle.apply(events.capture()), times(3));
            assertThat(events.getAllValues()).containsExactly(
                    new DepartmentCreatedEvent("1", "CS", "Building A", "123", "A. Smith"),
                    new DepartmentUpdatedEvent("1", "SE", "Building B", "456", "B. Smith"),
                    new DepartmentDeletedEvent("1"));

            aggregate.on((DepartmentCreatedEvent) events.getAllValues().get(0));
            aggregate.on((DepartmentUpdatedEvent) events.getAllValues().get(1));
            aggregate.on((DepartmentDeletedEvent) events.getAllValues().get(2));
        }
    }

    @Test
    void supportsTheNoArgsConstructorUsedByEventSourcing() {
        assertNotNull(new DepartmentAggregate());
    }

    @Test
    void queryRecordsCarryTheirParameters() {
        assertThat(new FindDepartmentQuery(7L).departmentId()).isEqualTo(7L);
        assertNotNull(new FindAllDepartmentsQuery());
    }
}

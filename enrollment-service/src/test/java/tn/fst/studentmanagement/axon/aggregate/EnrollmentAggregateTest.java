package tn.fst.studentmanagement.axon.aggregate;

import org.axonframework.modelling.command.AggregateLifecycle;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import tn.fst.studentmanagement.axon.command.CreateAxonEnrollmentCommand;
import tn.fst.studentmanagement.axon.command.DeleteAxonEnrollmentCommand;
import tn.fst.studentmanagement.axon.command.UpdateAxonEnrollmentCommand;
import tn.fst.studentmanagement.axon.event.AxonEnrollmentCreatedEvent;
import tn.fst.studentmanagement.axon.event.AxonEnrollmentDeletedEvent;
import tn.fst.studentmanagement.axon.event.AxonEnrollmentUpdatedEvent;
import tn.fst.studentmanagement.axon.query.FindAllAxonEnrollmentsQuery;
import tn.fst.studentmanagement.axon.query.FindAxonEnrollmentQuery;
import tn.fst.studentmanagement.entities.Status;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.times;

class EnrollmentAggregateTest {

    private static final LocalDate DATE = LocalDate.of(2026, 11, 22);

    @Test
    void appliesCommandsAsEventsAndReplaysThem() {
        CreateAxonEnrollmentCommand create = new CreateAxonEnrollmentCommand(
                "e-1", DATE, 12.5, Status.ACTIVE, 7L, 3L);
        UpdateAxonEnrollmentCommand update = new UpdateAxonEnrollmentCommand(
                "e-1", DATE, 17.0, Status.COMPLETED, 8L, 4L);
        DeleteAxonEnrollmentCommand delete = new DeleteAxonEnrollmentCommand("e-1");

        try (MockedStatic<AggregateLifecycle> lifecycle = mockStatic(AggregateLifecycle.class)) {
            EnrollmentAggregate aggregate = new EnrollmentAggregate(create);
            aggregate.handle(update);
            aggregate.handle(delete);

            ArgumentCaptor<Object> events = ArgumentCaptor.forClass(Object.class);
            lifecycle.verify(() -> AggregateLifecycle.apply(events.capture()), times(3));
            assertThat(events.getAllValues()).containsExactly(
                    new AxonEnrollmentCreatedEvent("e-1", DATE, 12.5, Status.ACTIVE, 7L, 3L),
                    new AxonEnrollmentUpdatedEvent("e-1", DATE, 17.0, Status.COMPLETED, 8L, 4L),
                    new AxonEnrollmentDeletedEvent("e-1"));

            aggregate.on((AxonEnrollmentCreatedEvent) events.getAllValues().get(0));
            aggregate.on((AxonEnrollmentUpdatedEvent) events.getAllValues().get(1));
            aggregate.on((AxonEnrollmentDeletedEvent) events.getAllValues().get(2));

            // A deleted aggregate ignores further updates and deletes.
            aggregate.handle(update);
            aggregate.handle(delete);
            lifecycle.verify(() -> AggregateLifecycle.apply(events.capture()), times(3));
        }
    }

    @Test
    void supportsTheNoArgsConstructorUsedByEventSourcing() {
        assertNotNull(new EnrollmentAggregate());
    }

    @Test
    void messagesCarryTheirIdentifierAndPayload() {
        assertThat(new FindAxonEnrollmentQuery("e-1").enrollmentId()).isEqualTo("e-1");
        assertNotNull(new FindAllAxonEnrollmentsQuery());
        assertThat(new DeleteAxonEnrollmentCommand("e-2").enrollmentId()).isEqualTo("e-2");
    }
}

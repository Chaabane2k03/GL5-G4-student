package tn.fst.studentmanagement.cqrs;

import org.axonframework.modelling.command.AggregateLifecycle;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import tn.fst.studentmanagement.cqrs.StudentCommandsAndEvents.CreateStudentCommand;
import tn.fst.studentmanagement.cqrs.StudentCommandsAndEvents.DeleteStudentCommand;
import tn.fst.studentmanagement.cqrs.StudentCommandsAndEvents.FindAllStudentsQuery;
import tn.fst.studentmanagement.cqrs.StudentCommandsAndEvents.FindStudentQuery;
import tn.fst.studentmanagement.cqrs.StudentCommandsAndEvents.StudentCreatedEvent;
import tn.fst.studentmanagement.cqrs.StudentCommandsAndEvents.StudentDeletedEvent;
import tn.fst.studentmanagement.cqrs.StudentCommandsAndEvents.StudentUpdatedEvent;
import tn.fst.studentmanagement.cqrs.StudentCommandsAndEvents.UpdateStudentCommand;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.times;

class StudentAggregateTest {

    private static final LocalDate BIRTHDAY = LocalDate.of(2000, 1, 1);

    @Test
    void appliesCommandsAsEventsAndReplaysThem() {
        CreateStudentCommand create = new CreateStudentCommand("1", "John", "Doe", "john@example.com",
                "123", BIRTHDAY, "Tunis", 3L);
        UpdateStudentCommand update = new UpdateStudentCommand("1", "Jane", "Doe", "jane@example.com",
                "456", BIRTHDAY, "Sfax", 4L);
        DeleteStudentCommand delete = new DeleteStudentCommand("1");

        try (MockedStatic<AggregateLifecycle> lifecycle = mockStatic(AggregateLifecycle.class)) {
            StudentAggregate aggregate = new StudentAggregate(create);
            aggregate.handle(update);
            aggregate.handle(delete);

            ArgumentCaptor<Object> events = ArgumentCaptor.forClass(Object.class);
            lifecycle.verify(() -> AggregateLifecycle.apply(events.capture()), times(3));
            assertThat(events.getAllValues()).containsExactly(
                    new StudentCreatedEvent("1", "John", "Doe", "john@example.com",
                            "123", BIRTHDAY, "Tunis", 3L),
                    new StudentUpdatedEvent("1", "Jane", "Doe", "jane@example.com",
                            "456", BIRTHDAY, "Sfax", 4L),
                    new StudentDeletedEvent("1"));

            aggregate.on((StudentCreatedEvent) events.getAllValues().get(0));
            aggregate.on((StudentUpdatedEvent) events.getAllValues().get(1));
            aggregate.on((StudentDeletedEvent) events.getAllValues().get(2));
        }
    }

    @Test
    void supportsTheNoArgsConstructorUsedByEventSourcing() {
        assertNotNull(new StudentAggregate());
    }

    @Test
    void queryRecordsCarryTheirParameters() {
        assertThat(new FindStudentQuery(7L).studentId()).isEqualTo(7L);
        assertNotNull(new FindAllStudentsQuery());
    }
}

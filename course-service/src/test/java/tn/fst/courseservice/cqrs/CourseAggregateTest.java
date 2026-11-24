package tn.fst.courseservice.cqrs;

import org.axonframework.modelling.command.AggregateLifecycle;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mockStatic;

/**
 * Unit tests for the aggregate's command and event-sourcing handlers. Static mocking keeps
 * {@link AggregateLifecycle} calls isolated from the rest of the Axon infrastructure.
 */
class CourseAggregateTest {

    @Test
    void createCommandShouldApplyCourseCreatedEvent() {
        CreateCourseCommand command = new CreateCourseCommand("5", "CS101", "Intro", "desc", 6, 2L);
        CourseCreatedEvent expected =
                new CourseCreatedEvent("5", "CS101", "Intro", "desc", 6, 2L);

        try (MockedStatic<AggregateLifecycle> lifecycle = mockStatic(AggregateLifecycle.class)) {
            new CourseAggregate(command);

            lifecycle.verify(() -> AggregateLifecycle.apply(expected));
        }
    }

    @Test
    void updateCommandShouldApplyCourseUpdatedEvent() {
        CourseAggregate aggregate = new CourseAggregate();
        UpdateCourseCommand command = new UpdateCourseCommand("5", "CS102", "New", "new desc", 9, 7L);
        CourseUpdatedEvent expected =
                new CourseUpdatedEvent("5", "CS102", "New", "new desc", 9, 7L);

        try (MockedStatic<AggregateLifecycle> lifecycle = mockStatic(AggregateLifecycle.class)) {
            aggregate.handle(command);

            lifecycle.verify(() -> AggregateLifecycle.apply(expected));
        }
    }

    @Test
    void archiveCommandShouldApplyCourseArchivedEvent() {
        CourseAggregate aggregate = new CourseAggregate();
        ArchiveCourseCommand command = new ArchiveCourseCommand("5");
        CourseArchivedEvent expected = new CourseArchivedEvent("5");

        try (MockedStatic<AggregateLifecycle> lifecycle = mockStatic(AggregateLifecycle.class)) {
            aggregate.handle(command);

            lifecycle.verify(() -> AggregateLifecycle.apply(expected));
        }
    }

    @Test
    void activateCommandShouldApplyCourseActivatedEvent() {
        CourseAggregate aggregate = new CourseAggregate();
        ActivateCourseCommand command = new ActivateCourseCommand("5");
        CourseActivatedEvent expected = new CourseActivatedEvent("5");

        try (MockedStatic<AggregateLifecycle> lifecycle = mockStatic(AggregateLifecycle.class)) {
            aggregate.handle(command);

            lifecycle.verify(() -> AggregateLifecycle.apply(expected));
        }
    }

    @Test
    void eventSourcingHandlersShouldAssignAggregateIdentifier() {
        CourseAggregate aggregate = new CourseAggregate();

        aggregate.on(new CourseCreatedEvent("1", "CS101", "Intro", "desc", 6, 2L));
        assertThat(ReflectionTestUtils.getField(aggregate, "courseId")).isEqualTo("1");

        aggregate.on(new CourseUpdatedEvent("2", "CS101", "New", "desc", 6, 2L));
        assertThat(ReflectionTestUtils.getField(aggregate, "courseId")).isEqualTo("2");

        aggregate.on(new CourseArchivedEvent("3"));
        assertThat(ReflectionTestUtils.getField(aggregate, "courseId")).isEqualTo("3");

        aggregate.on(new CourseActivatedEvent("4"));
        assertThat(ReflectionTestUtils.getField(aggregate, "courseId")).isEqualTo("4");
    }
}

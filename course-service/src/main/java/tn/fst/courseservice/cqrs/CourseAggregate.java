package tn.fst.courseservice.cqrs;

import org.axonframework.commandhandling.CommandHandler;
import org.axonframework.eventsourcing.EventSourcingHandler;
import org.axonframework.modelling.command.AggregateIdentifier;
import org.axonframework.modelling.command.AggregateLifecycle;
import org.axonframework.spring.stereotype.Aggregate;

@Aggregate
public class CourseAggregate {
    @AggregateIdentifier
    private String courseId;

    protected CourseAggregate() {}

    @CommandHandler
    public CourseAggregate(CreateCourseCommand command) {
        AggregateLifecycle.apply(new CourseCreatedEvent(command.courseId(), command.code(), command.title(),
                command.description(), command.credits(), command.departmentId()));
    }

    @CommandHandler
    public void handle(UpdateCourseCommand command) {
        AggregateLifecycle.apply(new CourseUpdatedEvent(command.courseId(), command.code(), command.title(),
                command.description(), command.credits(), command.departmentId()));
    }

    @CommandHandler
    public void handle(ArchiveCourseCommand command) {
        AggregateLifecycle.apply(new CourseArchivedEvent(command.courseId()));
    }

    @CommandHandler
    public void handle(ActivateCourseCommand command) {
        AggregateLifecycle.apply(new CourseActivatedEvent(command.courseId()));
    }

    @EventSourcingHandler
    public void on(CourseCreatedEvent event) { courseId = event.courseId(); }

    @EventSourcingHandler
    public void on(CourseUpdatedEvent event) { courseId = event.courseId(); }

    @EventSourcingHandler
    public void on(CourseArchivedEvent event) { courseId = event.courseId(); }

    @EventSourcingHandler
    public void on(CourseActivatedEvent event) { courseId = event.courseId(); }
}

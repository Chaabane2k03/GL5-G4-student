package tn.fst.studentmanagement.axon.projection;

import org.axonframework.eventhandling.EventHandler;
import org.axonframework.queryhandling.QueryHandler;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tn.fst.studentmanagement.axon.event.AxonEnrollmentCreatedEvent;
import tn.fst.studentmanagement.axon.event.AxonEnrollmentDeletedEvent;
import tn.fst.studentmanagement.axon.event.AxonEnrollmentUpdatedEvent;
import tn.fst.studentmanagement.axon.query.FindAllAxonEnrollmentsQuery;
import tn.fst.studentmanagement.axon.query.FindAxonEnrollmentQuery;

import java.util.List;

@Component("enrollment")
public class AxonEnrollmentProjection {

    private final AxonEnrollmentViewRepository repository;

    public AxonEnrollmentProjection(AxonEnrollmentViewRepository repository) {
        this.repository = repository;
    }

    @EventHandler
    @Transactional
    public void on(AxonEnrollmentCreatedEvent event) {
        repository.save(new AxonEnrollmentView(event.enrollmentId(), event.enrollmentDate(),
                event.grade(), event.status(), event.studentId(), event.courseId()));
    }

    @EventHandler
    @Transactional
    public void on(AxonEnrollmentUpdatedEvent event) {
        repository.findById(event.enrollmentId()).ifPresent(view -> {
            view.setEnrollmentDate(event.enrollmentDate());
            view.setGrade(event.grade());
            view.setStatus(event.status());
            view.setStudentId(event.studentId());
            view.setCourseId(event.courseId());
            repository.save(view);
        });
    }

    @EventHandler
    @Transactional
    public void on(AxonEnrollmentDeletedEvent event) {
        repository.deleteById(event.enrollmentId());
    }

    @QueryHandler
    public List<AxonEnrollmentView> handle(FindAllAxonEnrollmentsQuery query) {
        return repository.findAll();
    }

    @QueryHandler
    public AxonEnrollmentView handle(FindAxonEnrollmentQuery query) {
        return repository.findById(query.enrollmentId())
                .orElseThrow(() -> new IllegalArgumentException(
                        "Axon enrollment not found: " + query.enrollmentId()));
    }
}

package tn.fst.courseservice.cqrs;

import org.axonframework.eventhandling.EventHandler;
import org.axonframework.queryhandling.QueryHandler;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tn.fst.courseservice.entity.Course;
import tn.fst.courseservice.entity.CourseStatus;
import tn.fst.courseservice.exception.CourseNotFoundException;
import tn.fst.courseservice.repository.CourseRepository;

import java.util.List;

@Component
public class CourseProjection {
    private final CourseRepository repository;

    public CourseProjection(CourseRepository repository) { this.repository = repository; }

    @EventHandler
    @Transactional
    public void on(CourseCreatedEvent event) {
        repository.save(new Course(null, event.code(), event.title(), event.description(),
                event.credits(), event.departmentId(), CourseStatus.ACTIVE));
    }

    @EventHandler
    @Transactional
    public void on(CourseUpdatedEvent event) {
        repository.findById(Long.valueOf(event.courseId())).ifPresent(course -> {
            course.setCode(event.code());
            course.setTitle(event.title());
            course.setDescription(event.description());
            course.setCredits(event.credits());
            course.setDepartmentId(event.departmentId());
            repository.save(course);
        });
    }

    @EventHandler
    @Transactional
    public void on(CourseArchivedEvent event) {
        repository.findById(Long.valueOf(event.courseId())).ifPresent(course -> {
            course.setStatus(CourseStatus.ARCHIVED);
            repository.save(course);
        });
    }

    @EventHandler
    @Transactional
    public void on(CourseActivatedEvent event) {
        repository.findById(Long.valueOf(event.courseId())).ifPresent(course -> {
            course.setStatus(CourseStatus.ACTIVE);
            repository.save(course);
        });
    }

    @QueryHandler
    public Course handle(FindCourseQuery query) {
        return repository.findById(query.courseId()).orElseThrow(() -> new CourseNotFoundException(query.courseId()));
    }

    @QueryHandler
    public List<Course> handle(FindAllCoursesQuery query) { return repository.findAll(); }
}

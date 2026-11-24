package tn.fst.courseservice.cqrs;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tn.fst.courseservice.entity.Course;
import tn.fst.courseservice.entity.CourseStatus;
import tn.fst.courseservice.exception.CourseNotFoundException;
import tn.fst.courseservice.repository.CourseRepository;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Plain unit tests for the read-model projection: events mutate JPA entities through a mocked
 * repository, queries delegate to it.
 */
@ExtendWith(MockitoExtension.class)
class CourseProjectionTest {

    @Mock
    private CourseRepository repository;

    private CourseProjection projection;

    @BeforeEach
    void setUp() {
        projection = new CourseProjection(repository);
    }

    private static Course course(Long id, CourseStatus status) {
        return new Course(id, "CS101", "Intro", "desc", 6, 2L, status);
    }

    @Test
    void createdEventShouldSaveNewActiveCourse() {
        CourseCreatedEvent event =
                new CourseCreatedEvent("5", "CS102", "Algorithms", "desc", 8, 7L);

        projection.on(event);

        ArgumentCaptor<Course> captor = ArgumentCaptor.forClass(Course.class);
        verify(repository).save(captor.capture());
        Course saved = captor.getValue();
        assertThat(saved.getId()).isNull();
        assertThat(saved.getCode()).isEqualTo("CS102");
        assertThat(saved.getTitle()).isEqualTo("Algorithms");
        assertThat(saved.getDescription()).isEqualTo("desc");
        assertThat(saved.getCredits()).isEqualTo(8);
        assertThat(saved.getDepartmentId()).isEqualTo(7L);
        assertThat(saved.getStatus()).isEqualTo(CourseStatus.ACTIVE);
    }

    @Test
    void updatedEventShouldMutateAndSaveExistingCourse() {
        Course existing = course(5L, CourseStatus.ACTIVE);
        when(repository.findById(5L)).thenReturn(Optional.of(existing));

        projection.on(new CourseUpdatedEvent("5", "CS102", "New", "new desc", 9, 7L));

        assertThat(existing.getCode()).isEqualTo("CS102");
        assertThat(existing.getTitle()).isEqualTo("New");
        assertThat(existing.getDescription()).isEqualTo("new desc");
        assertThat(existing.getCredits()).isEqualTo(9);
        assertThat(existing.getDepartmentId()).isEqualTo(7L);
        verify(repository).save(existing);
    }

    @Test
    void updatedEventShouldIgnoreUnknownCourse() {
        when(repository.findById(5L)).thenReturn(Optional.empty());

        projection.on(new CourseUpdatedEvent("5", "CS102", "New", "new desc", 9, 7L));

        verify(repository, never()).save(any(Course.class));
    }

    @Test
    void archivedEventShouldSetArchivedStatusAndSave() {
        Course existing = course(5L, CourseStatus.ACTIVE);
        when(repository.findById(5L)).thenReturn(Optional.of(existing));

        projection.on(new CourseArchivedEvent("5"));

        assertThat(existing.getStatus()).isEqualTo(CourseStatus.ARCHIVED);
        verify(repository).save(existing);
    }

    @Test
    void archivedEventShouldIgnoreUnknownCourse() {
        when(repository.findById(5L)).thenReturn(Optional.empty());

        projection.on(new CourseArchivedEvent("5"));

        verify(repository, never()).save(any(Course.class));
    }

    @Test
    void activatedEventShouldSetActiveStatusAndSave() {
        Course existing = course(5L, CourseStatus.ARCHIVED);
        when(repository.findById(5L)).thenReturn(Optional.of(existing));

        projection.on(new CourseActivatedEvent("5"));

        assertThat(existing.getStatus()).isEqualTo(CourseStatus.ACTIVE);
        verify(repository).save(existing);
    }

    @Test
    void activatedEventShouldIgnoreUnknownCourse() {
        when(repository.findById(5L)).thenReturn(Optional.empty());

        projection.on(new CourseActivatedEvent("5"));

        verify(repository, never()).save(any(Course.class));
    }

    @Test
    void findCourseQueryShouldReturnCourseWhenPresent() {
        Course existing = course(5L, CourseStatus.ACTIVE);
        when(repository.findById(5L)).thenReturn(Optional.of(existing));

        assertThat(projection.handle(new FindCourseQuery(5L))).isSameAs(existing);
    }

    @Test
    void findCourseQueryShouldThrowWhenCourseIsMissing() {
        when(repository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> projection.handle(new FindCourseQuery(99L)))
                .isInstanceOf(CourseNotFoundException.class)
                .hasMessageContaining("99");
    }

    @Test
    void findAllCoursesQueryShouldReturnAllCourses() {
        List<Course> courses = List.of(course(5L, CourseStatus.ACTIVE));
        when(repository.findAll()).thenReturn(courses);

        assertThat(projection.handle(new FindAllCoursesQuery())).isSameAs(courses);
    }
}

package tn.fst.studentmanagement.command;

import feign.FeignException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tn.fst.studentmanagement.clients.CourseClient;
import tn.fst.studentmanagement.clients.StudentClient;
import tn.fst.studentmanagement.dto.CourseDto;
import tn.fst.studentmanagement.dto.StudentDto;
import tn.fst.studentmanagement.entities.Enrollment;
import tn.fst.studentmanagement.entities.Status;
import tn.fst.studentmanagement.exceptions.CourseNotFoundException;
import tn.fst.studentmanagement.exceptions.EnrollmentNotFoundException;
import tn.fst.studentmanagement.exceptions.StudentNotFoundException;
import tn.fst.studentmanagement.repositories.EnrollmentRepository;

import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EnrollmentCommandServiceTest {

    @Mock
    private EnrollmentRepository enrollmentRepository;

    @Mock
    private StudentClient studentClient;

    @Mock
    private CourseClient courseClient;

    @InjectMocks
    private EnrollmentCommandService commandService;

    private static StudentDto student() {
        return new StudentDto(7L, "John", "Doe", "john@example.com", "123",
                LocalDate.of(2000, 1, 1), "Tunis", 1L);
    }

    private static CourseDto course() {
        return new CourseDto(3L, "CS101", "Intro", "desc", 6, 1L, "ACTIVE");
    }

    private static CreateEnrollmentCommand createCommand(Long studentId, Long courseId) {
        return new CreateEnrollmentCommand(LocalDate.of(2024, 9, 1), 15.0, Status.ACTIVE, studentId, courseId);
    }

    @Test
    void create_persistsAndReturnsIdWhenReferencesExist() {
        when(studentClient.getStudent(7L)).thenReturn(student());
        when(courseClient.getCourse(3L)).thenReturn(course());
        when(enrollmentRepository.save(any(Enrollment.class))).thenAnswer(invocation -> {
            Enrollment saved = invocation.getArgument(0);
            saved.setIdEnrollment(42L);
            return saved;
        });

        Long id = commandService.create(createCommand(7L, 3L));

        assertThat(id).isEqualTo(42L);
        ArgumentCaptor<Enrollment> captor = ArgumentCaptor.forClass(Enrollment.class);
        verify(enrollmentRepository).save(captor.capture());
        assertThat(captor.getValue().getStudentId()).isEqualTo(7L);
        assertThat(captor.getValue().getCourseId()).isEqualTo(3L);
        assertThat(captor.getValue().getStatus()).isEqualTo(Status.ACTIVE);
    }

    @Test
    void create_translatesStudent404() {
        when(studentClient.getStudent(7L)).thenThrow(mock(FeignException.NotFound.class));

        assertThatThrownBy(() -> commandService.create(createCommand(7L, 3L)))
                .isInstanceOf(StudentNotFoundException.class);

        verify(enrollmentRepository, never()).save(any(Enrollment.class));
    }

    @Test
    void create_translatesCourse404() {
        when(studentClient.getStudent(7L)).thenReturn(student());
        when(courseClient.getCourse(3L)).thenThrow(mock(FeignException.NotFound.class));

        assertThatThrownBy(() -> commandService.create(createCommand(7L, 3L)))
                .isInstanceOf(CourseNotFoundException.class)
                .hasMessageContaining("3");

        verify(enrollmentRepository, never()).save(any(Enrollment.class));
    }

    @Test
    void create_skipsLookupsWhenReferencesAreNull() {
        when(enrollmentRepository.save(any(Enrollment.class))).thenAnswer(invocation -> {
            Enrollment saved = invocation.getArgument(0);
            saved.setIdEnrollment(1L);
            return saved;
        });

        Long id = commandService.create(createCommand(null, null));

        assertThat(id).isEqualTo(1L);
        verify(studentClient, never()).getStudent(anyLong());
        verify(courseClient, never()).getCourse(anyLong());
    }

    @Test
    void update_changesTheExistingEnrollment() {
        Enrollment existing = new Enrollment(1L, LocalDate.of(2024, 9, 1), null, Status.ACTIVE, 7L, 3L);
        when(enrollmentRepository.findById(1L)).thenReturn(Optional.of(existing));
        when(studentClient.getStudent(8L)).thenReturn(student());
        when(courseClient.getCourse(4L)).thenReturn(course());

        commandService.update(new UpdateEnrollmentCommand(
                1L, LocalDate.of(2025, 1, 10), 17.5, Status.COMPLETED, 8L, 4L));

        verify(enrollmentRepository).save(existing);
        assertThat(existing.getGrade()).isEqualTo(17.5);
        assertThat(existing.getStatus()).isEqualTo(Status.COMPLETED);
        assertThat(existing.getStudentId()).isEqualTo(8L);
        assertThat(existing.getCourseId()).isEqualTo(4L);
    }

    @Test
    void update_throwsWhenEnrollmentDoesNotExist() {
        when(enrollmentRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> commandService.update(new UpdateEnrollmentCommand(
                99L, LocalDate.of(2025, 1, 10), 10.0, Status.ACTIVE, 7L, 3L)))
                .isInstanceOf(EnrollmentNotFoundException.class);

        verify(enrollmentRepository, never()).save(any(Enrollment.class));
    }

    @Test
    void delete_removesExistingEnrollment() {
        when(enrollmentRepository.existsById(1L)).thenReturn(true);

        commandService.delete(1L);

        verify(enrollmentRepository).deleteById(1L);
    }

    @Test
    void delete_throwsWhenEnrollmentDoesNotExist() {
        when(enrollmentRepository.existsById(99L)).thenReturn(false);

        assertThatThrownBy(() -> commandService.delete(99L))
                .isInstanceOf(EnrollmentNotFoundException.class);

        verify(enrollmentRepository, never()).deleteById(anyLong());
    }
}
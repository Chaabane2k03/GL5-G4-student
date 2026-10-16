package tn.fst.studentmanagement.services;

import feign.FeignException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
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
import tn.fst.studentmanagement.exceptions.StudentNotFoundException;
import tn.fst.studentmanagement.repositories.EnrollmentRepository;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EnrollmentServiceTest {

    @Mock
    private EnrollmentRepository enrollmentRepository;

    @Mock
    private StudentClient studentClient;

    @Mock
    private CourseClient courseClient;

    @InjectMocks
    private EnrollmentService enrollmentService;

    private static Enrollment enrollment(Long studentId, Long courseId) {
        return new Enrollment(1L, LocalDate.of(2024, 9, 1), null, Status.ACTIVE, studentId, courseId);
    }

    private static StudentDto student() {
        return new StudentDto(7L, "John", "Doe", "john@example.com", "123",
                LocalDate.of(2000, 1, 1), "Tunis", 1L);
    }

    private static CourseDto course() {
        return new CourseDto(3L, "CS101", "Intro", "desc", 6, 1L, "ACTIVE");
    }

    @Test
    void saveEnrollment_persistsWhenReferencesExist() {
        Enrollment toSave = enrollment(7L, 3L);
        when(studentClient.getStudent(7L)).thenReturn(student());
        when(courseClient.getCourse(3L)).thenReturn(course());
        when(enrollmentRepository.save(toSave)).thenReturn(toSave);

        Enrollment result = enrollmentService.saveEnrollment(toSave);

        assertThat(result).isEqualTo(toSave);
        verify(studentClient).getStudent(7L);
        verify(courseClient).getCourse(3L);
        verify(enrollmentRepository).save(toSave);
    }

    @Test
    void saveEnrollment_translatesStudent404() {
        Enrollment toSave = enrollment(7L, 3L);
        when(studentClient.getStudent(7L)).thenThrow(mock(FeignException.NotFound.class));

        assertThatThrownBy(() -> enrollmentService.saveEnrollment(toSave))
                .isInstanceOf(StudentNotFoundException.class);

        verify(enrollmentRepository, never()).save(toSave);
    }

    @Test
    void saveEnrollment_translatesCourse404() {
        Enrollment toSave = enrollment(7L, 3L);
        when(studentClient.getStudent(7L)).thenReturn(student());
        when(courseClient.getCourse(3L)).thenThrow(mock(FeignException.NotFound.class));

        assertThatThrownBy(() -> enrollmentService.saveEnrollment(toSave))
                .isInstanceOf(CourseNotFoundException.class)
                .hasMessageContaining("3");

        verify(enrollmentRepository, never()).save(toSave);
    }

    @Test
    void saveEnrollment_skipsLookupsWhenReferencesAreNull() {
        Enrollment toSave = enrollment(null, null);
        when(enrollmentRepository.save(toSave)).thenReturn(toSave);

        Enrollment result = enrollmentService.saveEnrollment(toSave);

        assertThat(result).isEqualTo(toSave);
        verify(studentClient, never()).getStudent(anyLong());
        verify(courseClient, never()).getCourse(anyLong());
        verify(enrollmentRepository).save(toSave);
    }
}

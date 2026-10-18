package tn.fst.studentmanagement.query;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tn.fst.studentmanagement.entities.Enrollment;
import tn.fst.studentmanagement.entities.Status;
import tn.fst.studentmanagement.exceptions.EnrollmentNotFoundException;
import tn.fst.studentmanagement.repositories.EnrollmentRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EnrollmentQueryServiceTest {

    @Mock
    private EnrollmentRepository enrollmentRepository;

    @InjectMocks
    private EnrollmentQueryService queryService;

    private static Enrollment enrollment(Long id, Long studentId, Long courseId) {
        return new Enrollment(id, LocalDate.of(2024, 9, 1), 14.0, Status.ACTIVE, studentId, courseId);
    }

    @Test
    void getAll_mapsEntitiesToResponses() {
        when(enrollmentRepository.findAll()).thenReturn(List.of(enrollment(1L, 7L, 3L), enrollment(2L, 8L, 3L)));

        List<EnrollmentResponse> result = queryService.getAll();

        assertThat(result).hasSize(2);
        assertThat(result.get(0).idEnrollment()).isEqualTo(1L);
        assertThat(result.get(1).studentId()).isEqualTo(8L);
    }

    @Test
    void getById_returnsTheEnrollment() {
        when(enrollmentRepository.findById(1L)).thenReturn(Optional.of(enrollment(1L, 7L, 3L)));

        EnrollmentResponse result = queryService.getById(1L);

        assertThat(result.idEnrollment()).isEqualTo(1L);
        assertThat(result.courseId()).isEqualTo(3L);
        assertThat(result.status()).isEqualTo(Status.ACTIVE);
    }

    @Test
    void getById_throwsWhenMissing() {
        when(enrollmentRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> queryService.getById(99L))
                .isInstanceOf(EnrollmentNotFoundException.class)
                .hasMessageContaining("99");
    }

    @Test
    void getByStudent_filtersByStudent() {
        when(enrollmentRepository.findByStudentId(7L)).thenReturn(List.of(enrollment(1L, 7L, 3L)));

        assertThat(queryService.getByStudent(7L)).extracting(EnrollmentResponse::studentId).containsExactly(7L);
    }

    @Test
    void getByCourse_filtersByCourse() {
        when(enrollmentRepository.findByCourseId(3L)).thenReturn(List.of(enrollment(1L, 7L, 3L)));

        assertThat(queryService.getByCourse(3L)).extracting(EnrollmentResponse::courseId).containsExactly(3L);
    }
}
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

    private static final Enrollment ENROLLMENT = new Enrollment(
            42L, LocalDate.of(2026, 11, 22), 12.5, Status.ACTIVE, 7L, 3L);

    @Mock
    private EnrollmentRepository repository;

    @InjectMocks
    private EnrollmentQueryService queryService;

    @Test
    void mapsAllEnrollmentsToResponses() {
        when(repository.findAll()).thenReturn(List.of(ENROLLMENT));

        assertThat(queryService.getAll()).containsExactly(new EnrollmentResponse(
                42L, LocalDate.of(2026, 11, 22), 12.5, Status.ACTIVE, 7L, 3L));
    }

    @Test
    void mapsOneEnrollmentToResponseOrThrows() {
        when(repository.findById(42L)).thenReturn(Optional.of(ENROLLMENT));
        when(repository.findById(99L)).thenReturn(Optional.empty());

        assertThat(queryService.getById(42L).studentId()).isEqualTo(7L);
        assertThatThrownBy(() -> queryService.getById(99L))
                .isInstanceOf(EnrollmentNotFoundException.class);
    }

    @Test
    void filtersEnrollmentsByStudentAndCourse() {
        when(repository.findByStudentId(7L)).thenReturn(List.of(ENROLLMENT));
        when(repository.findByCourseId(3L)).thenReturn(List.of(ENROLLMENT));

        assertThat(queryService.getByStudent(7L)).hasSize(1);
        assertThat(queryService.getByCourse(3L)).hasSize(1);
    }
}

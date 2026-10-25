package tn.fst.studentmanagement.controllers;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tn.fst.studentmanagement.entities.Status;
import tn.fst.studentmanagement.query.EnrollmentQueryService;
import tn.fst.studentmanagement.query.EnrollmentResponse;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EnrollmentQueryControllerTest {

    private static final EnrollmentResponse SAMPLE = new EnrollmentResponse(
            42L, LocalDate.of(2025, 9, 1), 12.5, Status.ACTIVE, 1L, 2L);

    @Mock
    private EnrollmentQueryService queryService;

    @InjectMocks
    private EnrollmentQueryController controller;

    @Test
    void getAllEnrollment_delegatesToQueryService() {
        when(queryService.getAll()).thenReturn(List.of(SAMPLE));

        List<EnrollmentResponse> result = controller.getAllEnrollment();

        assertThat(result).containsExactly(SAMPLE);
        verify(queryService).getAll();
    }

    @Test
    void getEnrollment_delegatesToQueryService() {
        when(queryService.getById(42L)).thenReturn(SAMPLE);

        EnrollmentResponse result = controller.getEnrollment(42L);

        assertThat(result).isEqualTo(SAMPLE);
        verify(queryService).getById(42L);
    }

    @Test
    void getByStudent_delegatesToQueryService() {
        when(queryService.getByStudent(1L)).thenReturn(List.of(SAMPLE));

        List<EnrollmentResponse> result = controller.getByStudent(1L);

        assertThat(result).containsExactly(SAMPLE);
        verify(queryService).getByStudent(1L);
    }

    @Test
    void getByCourse_delegatesToQueryService() {
        when(queryService.getByCourse(2L)).thenReturn(List.of(SAMPLE));

        List<EnrollmentResponse> result = controller.getByCourse(2L);

        assertThat(result).containsExactly(SAMPLE);
        verify(queryService).getByCourse(2L);
    }
}

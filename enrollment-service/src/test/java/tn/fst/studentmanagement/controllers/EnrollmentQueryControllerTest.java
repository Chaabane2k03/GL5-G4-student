package tn.fst.studentmanagement.controllers;

import org.axonframework.queryhandling.QueryGateway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tn.fst.studentmanagement.axon.projection.AxonEnrollmentView;
import tn.fst.studentmanagement.axon.query.FindAxonEnrollmentQuery;
import tn.fst.studentmanagement.entities.Status;
import tn.fst.studentmanagement.exceptions.EnrollmentNotFoundException;
import tn.fst.studentmanagement.integration.AuditEntryRepository;
import tn.fst.studentmanagement.query.EnrollmentQueryService;
import tn.fst.studentmanagement.query.EnrollmentResponse;

import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.CompletableFuture;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EnrollmentQueryControllerTest {

    private static final EnrollmentResponse SAMPLE = new EnrollmentResponse(
            42L, LocalDate.of(2025, 9, 1), 12.5, Status.ACTIVE, 1L, 2L);

    @Mock
    private EnrollmentQueryService queryService;

    @Mock
    private QueryGateway queryGateway;

    @Mock
    private AuditEntryRepository auditEntryRepository;

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

    @Test
    void getAxonEnrollment_mapsNotFoundTo404Exception() {
        CompletableFuture<AxonEnrollmentView> failed = new CompletableFuture<>();
        failed.completeExceptionally(
                new IllegalArgumentException("Axon enrollment not found: missing-id"));
        when(queryGateway.query(any(FindAxonEnrollmentQuery.class), eq(AxonEnrollmentView.class)))
                .thenReturn(failed);

        assertThatThrownBy(() -> controller.getAxonEnrollment("missing-id"))
                .isInstanceOf(EnrollmentNotFoundException.class)
                .hasMessageContaining("not found");
    }
}

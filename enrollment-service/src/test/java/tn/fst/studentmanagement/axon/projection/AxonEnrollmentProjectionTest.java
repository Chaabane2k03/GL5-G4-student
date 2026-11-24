package tn.fst.studentmanagement.axon.projection;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tn.fst.studentmanagement.axon.event.AxonEnrollmentCreatedEvent;
import tn.fst.studentmanagement.axon.event.AxonEnrollmentDeletedEvent;
import tn.fst.studentmanagement.axon.event.AxonEnrollmentUpdatedEvent;
import tn.fst.studentmanagement.axon.query.FindAllAxonEnrollmentsQuery;
import tn.fst.studentmanagement.axon.query.FindAxonEnrollmentQuery;
import tn.fst.studentmanagement.entities.Status;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AxonEnrollmentProjectionTest {

    private static final LocalDate DATE = LocalDate.of(2026, 11, 22);

    @Mock
    private AxonEnrollmentViewRepository repository;

    @InjectMocks
    private AxonEnrollmentProjection projection;

    @Test
    void createsProjectionFromEvent() {
        projection.on(new AxonEnrollmentCreatedEvent("e-1", DATE, 12.5, Status.ACTIVE, 7L, 3L));

        ArgumentCaptor<AxonEnrollmentView> saved = ArgumentCaptor.forClass(AxonEnrollmentView.class);
        verify(repository).save(saved.capture());
        AxonEnrollmentView view = saved.getValue();
        assertThat(view.getEnrollmentId()).isEqualTo("e-1");
        assertThat(view.getEnrollmentDate()).isEqualTo(DATE);
        assertThat(view.getGrade()).isEqualTo(12.5);
        assertThat(view.getStatus()).isEqualTo(Status.ACTIVE);
        assertThat(view.getStudentId()).isEqualTo(7L);
        assertThat(view.getCourseId()).isEqualTo(3L);
    }

    @Test
    void updatesExistingProjectionFromEvent() {
        AxonEnrollmentView existing = new AxonEnrollmentView(
                "e-1", DATE, 12.5, Status.ACTIVE, 7L, 3L);
        when(repository.findById("e-1")).thenReturn(Optional.of(existing));

        projection.on(new AxonEnrollmentUpdatedEvent("e-1", DATE, 17.0, Status.COMPLETED, 8L, 4L));

        assertThat(existing.getEnrollmentDate()).isEqualTo(DATE);
        assertThat(existing.getGrade()).isEqualTo(17.0);
        assertThat(existing.getStatus()).isEqualTo(Status.COMPLETED);
        assertThat(existing.getStudentId()).isEqualTo(8L);
        assertThat(existing.getCourseId()).isEqualTo(4L);
        verify(repository).save(existing);
    }

    @Test
    void ignoresUpdateWhenProjectionIsMissing() {
        when(repository.findById("missing")).thenReturn(Optional.empty());

        projection.on(new AxonEnrollmentUpdatedEvent(
                "missing", DATE, 17.0, Status.COMPLETED, 8L, 4L));

        verify(repository, never()).save(any());
    }

    @Test
    void deletesProjectionFromEvent() {
        projection.on(new AxonEnrollmentDeletedEvent("e-1"));

        verify(repository).deleteById("e-1");
    }

    @Test
    void answersProjectionQueries() {
        AxonEnrollmentView view = new AxonEnrollmentView(
                "e-1", DATE, 12.5, Status.ACTIVE, 7L, 3L);
        when(repository.findAll()).thenReturn(List.of(view));
        when(repository.findById("e-1")).thenReturn(Optional.of(view));
        when(repository.findById("missing")).thenReturn(Optional.empty());

        assertThat(projection.handle(new FindAllAxonEnrollmentsQuery())).containsExactly(view);
        assertThat(projection.handle(new FindAxonEnrollmentQuery("e-1"))).isEqualTo(view);
        assertThatThrownBy(() -> projection.handle(new FindAxonEnrollmentQuery("missing")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("not found");
    }

    @Test
    void defaultConstructorOfViewIsUsable() {
        assertThat(new AxonEnrollmentView().getEnrollmentId()).isNull();
    }
}

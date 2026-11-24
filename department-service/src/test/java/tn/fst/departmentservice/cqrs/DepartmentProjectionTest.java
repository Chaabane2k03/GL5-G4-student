package tn.fst.departmentservice.cqrs;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tn.fst.departmentservice.controller.DepartmentNotFoundException;
import tn.fst.departmentservice.cqrs.DepartmentCommandsAndEvents.DepartmentCreatedEvent;
import tn.fst.departmentservice.cqrs.DepartmentCommandsAndEvents.DepartmentDeletedEvent;
import tn.fst.departmentservice.cqrs.DepartmentCommandsAndEvents.DepartmentUpdatedEvent;
import tn.fst.departmentservice.cqrs.DepartmentCommandsAndEvents.FindAllDepartmentsQuery;
import tn.fst.departmentservice.cqrs.DepartmentCommandsAndEvents.FindDepartmentQuery;
import tn.fst.departmentservice.entity.Department;
import tn.fst.departmentservice.repository.DepartmentRepository;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DepartmentProjectionTest {

    @Mock
    private DepartmentRepository repository;

    @InjectMocks
    private DepartmentProjection projection;

    @Test
    void createsDepartmentFromEvent() {
        projection.on(new DepartmentCreatedEvent("1", "CS", "Building A", "123", "A. Smith"));

        ArgumentCaptor<Department> saved = ArgumentCaptor.forClass(Department.class);
        verify(repository).save(saved.capture());
        assertThat(saved.getValue().getName()).isEqualTo("CS");
        assertThat(saved.getValue().getLocation()).isEqualTo("Building A");
        assertThat(saved.getValue().getPhone()).isEqualTo("123");
        assertThat(saved.getValue().getHead()).isEqualTo("A. Smith");
    }

    @Test
    void updatesExistingDepartmentFromEvent() {
        Department existing = new Department(1L, "CS", "Building A", "123", "A. Smith");
        when(repository.findById(1L)).thenReturn(Optional.of(existing));

        projection.on(new DepartmentUpdatedEvent("1", "SE", "Building B", "456", "B. Smith"));

        assertThat(existing.getName()).isEqualTo("SE");
        assertThat(existing.getLocation()).isEqualTo("Building B");
        assertThat(existing.getPhone()).isEqualTo("456");
        assertThat(existing.getHead()).isEqualTo("B. Smith");
        verify(repository).save(existing);
    }

    @Test
    void ignoresUpdateWhenDepartmentIsMissing() {
        when(repository.findById(9L)).thenReturn(Optional.empty());

        projection.on(new DepartmentUpdatedEvent("9", "SE", "Building B", "456", "B. Smith"));

        verify(repository, never()).save(any());
    }

    @Test
    void deletesDepartmentFromEvent() {
        projection.on(new DepartmentDeletedEvent("3"));

        verify(repository).deleteById(3L);
    }

    @Test
    void answersFindAllAndFindByIdQueries() {
        Department department = new Department(1L, "CS", "Building A", "123", "A. Smith");
        when(repository.findAll()).thenReturn(List.of(department));
        when(repository.findById(1L)).thenReturn(Optional.of(department));
        when(repository.findById(99L)).thenReturn(Optional.empty());

        assertThat(projection.handle(new FindAllDepartmentsQuery())).containsExactly(department);
        assertThat(projection.handle(new FindDepartmentQuery(1L))).isEqualTo(department);
        assertThatThrownBy(() -> projection.handle(new FindDepartmentQuery(99L)))
                .isInstanceOf(DepartmentNotFoundException.class);
    }
}

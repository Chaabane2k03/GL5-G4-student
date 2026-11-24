package tn.fst.studentmanagement.cqrs;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tn.fst.studentmanagement.cqrs.StudentCommandsAndEvents.FindAllStudentsQuery;
import tn.fst.studentmanagement.cqrs.StudentCommandsAndEvents.FindStudentQuery;
import tn.fst.studentmanagement.cqrs.StudentCommandsAndEvents.StudentCreatedEvent;
import tn.fst.studentmanagement.cqrs.StudentCommandsAndEvents.StudentDeletedEvent;
import tn.fst.studentmanagement.cqrs.StudentCommandsAndEvents.StudentUpdatedEvent;
import tn.fst.studentmanagement.entities.Student;
import tn.fst.studentmanagement.repositories.StudentRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StudentProjectionTest {

    private static final LocalDate BIRTHDAY = LocalDate.of(2000, 1, 1);

    @Mock
    private StudentRepository repository;

    @InjectMocks
    private StudentProjection projection;

    @Test
    void createsStudentFromEvent() {
        projection.on(new StudentCreatedEvent("1", "John", "Doe", "john@example.com",
                "123", BIRTHDAY, "Tunis", 3L));

        ArgumentCaptor<Student> saved = ArgumentCaptor.forClass(Student.class);
        verify(repository).save(saved.capture());
        assertThat(saved.getValue().getFirstName()).isEqualTo("John");
        assertThat(saved.getValue().getLastName()).isEqualTo("Doe");
        assertThat(saved.getValue().getEmail()).isEqualTo("john@example.com");
        assertThat(saved.getValue().getPhone()).isEqualTo("123");
        assertThat(saved.getValue().getDateOfBirth()).isEqualTo(BIRTHDAY);
        assertThat(saved.getValue().getAddress()).isEqualTo("Tunis");
        assertThat(saved.getValue().getDepartmentId()).isEqualTo(3L);
    }

    @Test
    void updatesExistingStudentFromEvent() {
        Student existing = new Student(1L, "John", "Doe", "john@example.com",
                "123", BIRTHDAY, "Tunis", 3L);
        when(repository.findById(1L)).thenReturn(Optional.of(existing));

        projection.on(new StudentUpdatedEvent("1", "Jane", "Roe", "jane@example.com",
                "456", BIRTHDAY, "Sfax", 4L));

        assertThat(existing.getFirstName()).isEqualTo("Jane");
        assertThat(existing.getLastName()).isEqualTo("Roe");
        assertThat(existing.getEmail()).isEqualTo("jane@example.com");
        assertThat(existing.getPhone()).isEqualTo("456");
        assertThat(existing.getAddress()).isEqualTo("Sfax");
        assertThat(existing.getDepartmentId()).isEqualTo(4L);
        verify(repository).save(existing);
    }

    @Test
    void ignoresUpdateWhenStudentIsMissing() {
        when(repository.findById(9L)).thenReturn(Optional.empty());

        projection.on(new StudentUpdatedEvent("9", "Jane", "Roe", "jane@example.com",
                "456", BIRTHDAY, "Sfax", 4L));

        verify(repository, never()).save(any());
    }

    @Test
    void deletesStudentFromEvent() {
        projection.on(new StudentDeletedEvent("3"));

        verify(repository).deleteById(3L);
    }

    @Test
    void answersFindAllAndFindByIdQueries() {
        Student student = new Student(1L, "John", "Doe", "john@example.com",
                "123", BIRTHDAY, "Tunis", 3L);
        when(repository.findAll()).thenReturn(List.of(student));
        when(repository.findById(1L)).thenReturn(Optional.of(student));
        when(repository.findById(99L)).thenReturn(Optional.empty());

        assertThat(projection.handle(new FindAllStudentsQuery())).containsExactly(student);
        assertThat(projection.handle(new FindStudentQuery(1L))).isEqualTo(student);
        assertThatThrownBy(() -> projection.handle(new FindStudentQuery(99L)))
                .isInstanceOf(NoSuchElementException.class);
    }
}

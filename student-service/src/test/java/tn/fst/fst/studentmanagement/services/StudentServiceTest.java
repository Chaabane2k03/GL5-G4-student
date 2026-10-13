package tn.fst.studentmanagement.services;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tn.fst.studentmanagement.entities.Student;
import tn.fst.studentmanagement.repositories.StudentRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StudentServiceTest {

    @Mock
    private StudentRepository studentRepository;

    @InjectMocks
    private StudentService studentService;

    private Student sampleStudent() {
        return new Student(1L, "John", "Doe", "john.doe@example.com",
                "12345678", LocalDate.of(2000, 1, 15), "Tunis", 10L);
    }

    @Test
    void getAllStudents_returnsAllStudents() {
        when(studentRepository.findAll()).thenReturn(List.of(sampleStudent()));

        List<Student> result = studentService.getAllStudents();

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getEmail()).isEqualTo("john.doe@example.com");
        verify(studentRepository).findAll();
    }

    @Test
    void getStudentById_existingId_returnsStudent() {
        when(studentRepository.findById(1L)).thenReturn(Optional.of(sampleStudent()));

        Student result = studentService.getStudentById(1L);

        assertThat(result).isNotNull();
        assertThat(result.getFirstName()).isEqualTo("John");
        verify(studentRepository).findById(1L);
    }

    @Test
    void getStudentById_missingId_returnsNull() {
        when(studentRepository.findById(99L)).thenReturn(Optional.empty());

        Student result = studentService.getStudentById(99L);

        assertThat(result).isNull();
        verify(studentRepository).findById(99L);
    }

    @Test
    void saveStudent_delegatesToRepository() {
        Student toSave = sampleStudent();
        when(studentRepository.save(toSave)).thenReturn(toSave);

        Student result = studentService.saveStudent(toSave);

        assertThat(result).isEqualTo(toSave);
        verify(studentRepository).save(toSave);
    }

    @Test
    void deleteStudent_delegatesToRepository() {
        studentService.deleteStudent(1L);

        verify(studentRepository).deleteById(1L);
    }
}

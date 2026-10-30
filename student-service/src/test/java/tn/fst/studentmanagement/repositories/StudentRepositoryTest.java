package tn.fst.studentmanagement.repositories;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import tn.fst.studentmanagement.entities.Student;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
class StudentRepositoryTest {

    @Autowired
    private StudentRepository studentRepository;

    private Student sampleStudent() {
        return new Student(null, "John", "Doe", "john.doe@example.com",
                "12345678", LocalDate.of(2000, 1, 15), "Tunis", 10L);
    }

    @Test
    void save_assignsIdAndCanBeFound() {
        Student saved = studentRepository.save(sampleStudent());

        assertThat(saved.getIdStudent()).isNotNull();

        Student found = studentRepository.findById(saved.getIdStudent()).orElse(null);

        assertThat(found).isNotNull();
        assertThat(found.getEmail()).isEqualTo("john.doe@example.com");
        assertThat(found.getDepartmentId()).isEqualTo(10L);
    }

    @Test
    void findAll_returnsSavedStudents() {
        studentRepository.save(sampleStudent());
        studentRepository.save(new Student(null, "Jane", "Doe", "jane.doe@example.com",
                "87654321", LocalDate.of(2001, 5, 20), "Sfax", 11L));

        List<Student> all = studentRepository.findAll();

        assertThat(all).hasSize(2);
    }

    @Test
    void deleteById_removesStudent() {
        Student saved = studentRepository.save(sampleStudent());

        studentRepository.deleteById(saved.getIdStudent());

        assertThat(studentRepository.findById(saved.getIdStudent())).isEmpty();
    }
}

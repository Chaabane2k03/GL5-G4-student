package tn.fst.studentmanagement.entities;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

class StudentTest {

    @Test
    void exposesAndMutatesAllFields() {
        Student student = new Student();
        LocalDate birthday = LocalDate.of(2001, 5, 20);

        student.setIdStudent(12L);
        student.setFirstName("Ada");
        student.setLastName("Lovelace");
        student.setEmail("ada@example.com");
        student.setPhone("123");
        student.setDateOfBirth(birthday);
        student.setAddress("London");
        student.setDepartmentId(3L);

        assertThat(student.getIdStudent()).isEqualTo(12L);
        assertThat(student.getFirstName()).isEqualTo("Ada");
        assertThat(student.getLastName()).isEqualTo("Lovelace");
        assertThat(student.getEmail()).isEqualTo("ada@example.com");
        assertThat(student.getPhone()).isEqualTo("123");
        assertThat(student.getDateOfBirth()).isEqualTo(birthday);
        assertThat(student.getAddress()).isEqualTo("London");
        assertThat(student.getDepartmentId()).isEqualTo(3L);
    }
}

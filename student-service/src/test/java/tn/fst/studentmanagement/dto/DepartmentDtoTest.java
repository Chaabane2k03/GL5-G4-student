package tn.fst.studentmanagement.dto;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class DepartmentDtoTest {

    @Test
    void exposesEveryComponent() {
        DepartmentDto dto = new DepartmentDto(7L, "Computer Science", "Building A", "123", "A. Smith");

        assertThat(dto.idDepartment()).isEqualTo(7L);
        assertThat(dto.name()).isEqualTo("Computer Science");
        assertThat(dto.location()).isEqualTo("Building A");
        assertThat(dto.phone()).isEqualTo("123");
        assertThat(dto.head()).isEqualTo("A. Smith");
    }
}

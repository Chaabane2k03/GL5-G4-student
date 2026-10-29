package tn.fst.course.dto;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class DepartmentDtoTest {

    @Test
    void shouldExposeAllMappedFields() {
        DepartmentDto dto = new DepartmentDto(1L, "Computer Science", "Building A", "123", "A. Smith");

        assertThat(dto.idDepartment()).isEqualTo(1L);
        assertThat(dto.name()).isEqualTo("Computer Science");
        assertThat(dto.location()).isEqualTo("Building A");
        assertThat(dto.phone()).isEqualTo("123");
        assertThat(dto.head()).isEqualTo("A. Smith");
    }

    @Test
    void shouldDeserializeDepartmentPayloadAndIgnoreUnknownProperties() throws Exception {
        ObjectMapper mapper = new ObjectMapper()
                .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

        DepartmentDto dto = mapper.readValue("""
                {
                  "idDepartment": 7,
                  "name": "Physics",
                  "location": "Building B",
                  "phone": "555",
                  "head": "B. Jones",
                  "unmappedField": "ignored"
                }
                """, DepartmentDto.class);

        assertThat(dto).isEqualTo(new DepartmentDto(7L, "Physics", "Building B", "555", "B. Jones"));
    }
}

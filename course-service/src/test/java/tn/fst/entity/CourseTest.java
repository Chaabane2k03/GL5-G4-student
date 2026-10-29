package tn.fst.course.entity;

import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

class CourseTest {

    private static Course course(Long id) {
        return new Course(id, "CS101", "Title", "desc", 3, 1L, CourseStatus.ACTIVE);
    }

    @Test
    void equalsShouldBeReflexive() {
        Course a = course(1L);

        assertThat(a).isEqualTo(a);
    }

    @Test
    void equalsShouldIgnoreOtherFieldsWhenIdMatches() {
        Course a = course(1L);
        Course b = new Course(1L, "OTHER", "Other", "o", 9, 9L, CourseStatus.ARCHIVED);

        assertThat(a).isEqualTo(b).hasSameHashCodeAs(b);
    }

    @Test
    void equalsShouldReturnFalseForDifferentId() {
        assertThat(course(1L)).isNotEqualTo(course(2L));
    }

    @Test
    void equalsShouldReturnFalseForNullOrDifferentType() {
        Course a = course(1L);

        assertThat(a).isNotEqualTo(null).isNotEqualTo("not a course");
    }

    @Test
    void equalsShouldReturnFalseWhenIdIsNull() {
        Course a = new Course();
        Course b = new Course();

        assertThat(a).isNotEqualTo(b);
    }

    @Test
    void toStringShouldIncludeKeyFields() {
        String rendered = course(1L).toString();

        assertThat(rendered)
                .contains("id=1")
                .contains("code='CS101'")
                .contains("status=ACTIVE");
    }

    @Test
    void settersAndGettersShouldRoundTrip() {
        Course c = new Course();
        LocalDateTime created = LocalDateTime.of(2024, 1, 1, 0, 0);
        LocalDateTime updated = LocalDateTime.of(2024, 1, 2, 0, 0);

        c.setId(7L);
        c.setCode("MA101");
        c.setTitle("Math");
        c.setDescription("desc");
        c.setCredits(4);
        c.setDepartmentId(3L);
        c.setStatus(CourseStatus.ARCHIVED);
        c.setCreatedAt(created);
        c.setUpdatedAt(updated);

        assertThat(c.getId()).isEqualTo(7L);
        assertThat(c.getCode()).isEqualTo("MA101");
        assertThat(c.getTitle()).isEqualTo("Math");
        assertThat(c.getDescription()).isEqualTo("desc");
        assertThat(c.getCredits()).isEqualTo(4);
        assertThat(c.getDepartmentId()).isEqualTo(3L);
        assertThat(c.getStatus()).isEqualTo(CourseStatus.ARCHIVED);
        assertThat(c.getCreatedAt()).isEqualTo(created);
        assertThat(c.getUpdatedAt()).isEqualTo(updated);
    }
}

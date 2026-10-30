package tn.fst.courseservice.repository;

import tn.fst.courseservice.entity.Course;
import tn.fst.courseservice.entity.CourseStatus;
import tn.fst.courseservice.support.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Persistence-layer tests running against the shared MySQL Testcontainer so that
 * {@code schema.sql} (unique key + CHECK constraints) is exercised for real.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
class CourseRepositoryTest {

    @Autowired
    private CourseRepository courseRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private static Course newCourse(String code, int credits, long departmentId, CourseStatus status) {
        return new Course(null, code, "Title " + code, "desc", credits, departmentId, status);
    }

    private static Specification<Course> departmentIs(long departmentId) {
        return (root, query, cb) -> cb.equal(root.get("departmentId"), departmentId);
    }

    private static Specification<Course> statusIs(CourseStatus status) {
        return (root, query, cb) -> cb.equal(root.get("status"), status);
    }

    @Test
    void shouldPersistAndPopulateAuditTimestamps() {
        Course saved = courseRepository.saveAndFlush(newCourse("CS101", 6, 1L, CourseStatus.ACTIVE));

        assertThat(saved.getId()).isNotNull();
        assertThat(saved.getCreatedAt()).isNotNull();
        assertThat(saved.getUpdatedAt()).isNotNull();
        assertThat(courseRepository.findById(saved.getId())).contains(saved);
    }

    @Test
    void shouldFindByCode() {
        courseRepository.saveAndFlush(newCourse("CS101", 6, 1L, CourseStatus.ACTIVE));

        assertThat(courseRepository.existsByCode("CS101")).isTrue();
        assertThat(courseRepository.existsByCode("NOPE")).isFalse();
    }

    @Test
    void existsByCodeAndIdNotShouldIgnoreTheSameRow() {
        Course saved = courseRepository.saveAndFlush(newCourse("CS101", 6, 1L, CourseStatus.ACTIVE));

        assertThat(courseRepository.existsByCodeAndIdNot("CS101", saved.getId())).isFalse();
        assertThat(courseRepository.existsByCodeAndIdNot("CS101", 999_999L)).isTrue();
    }

    @Test
    void shouldRejectDuplicateCodeAtDatabaseLevel() {
        courseRepository.saveAndFlush(newCourse("CS101", 6, 1L, CourseStatus.ACTIVE));

        Course duplicate = newCourse("CS101", 6, 2L, CourseStatus.ACTIVE);
        assertThatThrownBy(() -> courseRepository.saveAndFlush(duplicate))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void shouldRejectCreditsBelowOne() {
        assertThatThrownBy(() -> jdbcTemplate.update(
                "INSERT INTO course (code, title, credits, department_id, status) VALUES (?,?,?,?,?)",
                "CS100", "Too few credits", 0, 1L, "ACTIVE"))
                .isInstanceOf(DataAccessException.class)
                .hasRootCauseInstanceOf(java.sql.SQLException.class);
    }

    @Test
    void shouldRejectCreditsAboveThirty() {
        assertThatThrownBy(() -> jdbcTemplate.update(
                "INSERT INTO course (code, title, credits, department_id, status) VALUES (?,?,?,?,?)",
                "CS101", "Too many credits", 31, 1L, "ACTIVE"))
                .isInstanceOf(DataAccessException.class)
                .hasRootCauseInstanceOf(java.sql.SQLException.class);
    }

    @Test
    void shouldAcceptBoundaryCredits() {
        Course low = courseRepository.saveAndFlush(newCourse("CS100", 1, 1L, CourseStatus.ACTIVE));
        Course high = courseRepository.saveAndFlush(newCourse("CS101", 30, 1L, CourseStatus.ACTIVE));

        assertThat(low.getId()).isNotNull();
        assertThat(high.getId()).isNotNull();
    }

    @Test
    void shouldRejectUnknownStatusViaCheckConstraint() {
        assertThatThrownBy(() -> jdbcTemplate.update(
                "INSERT INTO course (code, title, credits, department_id, status) VALUES (?,?,?,?,?)",
                "CS999", "Bad status", 3, 1L, "INVALID"))
                .isInstanceOf(DataAccessException.class)
                .hasRootCauseInstanceOf(java.sql.SQLException.class);
    }

    @Test
    void shouldFilterByDepartmentAndStatus() {
        courseRepository.saveAndFlush(newCourse("CS101", 6, 1L, CourseStatus.ACTIVE));
        courseRepository.saveAndFlush(newCourse("CS102", 6, 1L, CourseStatus.ARCHIVED));
        courseRepository.saveAndFlush(newCourse("MA101", 6, 2L, CourseStatus.ACTIVE));
        courseRepository.flush();

        List<Course> activeInDept1 = courseRepository.findAll(
                Specification.allOf(departmentIs(1L), statusIs(CourseStatus.ACTIVE)));

        assertThat(activeInDept1).extracting(Course::getCode).containsExactly("CS101");
    }

    @Test
    void shouldReturnAllWhenFiltersNull() {
        courseRepository.saveAndFlush(newCourse("CS101", 6, 1L, CourseStatus.ACTIVE));
        courseRepository.saveAndFlush(newCourse("CS102", 6, 2L, CourseStatus.ARCHIVED));

        List<Course> all = courseRepository.findAll(Specification.allOf(null, null));

        assertThat(all).hasSize(2);
    }

    @Test
    void shouldPaginateAndSort() {
        courseRepository.saveAndFlush(newCourse("MA101", 6, 1L, CourseStatus.ACTIVE));
        courseRepository.saveAndFlush(newCourse("CS101", 6, 1L, CourseStatus.ACTIVE));
        courseRepository.saveAndFlush(newCourse("PH101", 6, 1L, CourseStatus.ACTIVE));
        courseRepository.flush();

        Page<Course> firstPage = courseRepository.findAll(
                Specification.allOf(null, null),
                PageRequest.of(0, 2, Sort.by(Sort.Direction.ASC, "code")));

        assertThat(firstPage.getTotalElements()).isEqualTo(3);
        assertThat(firstPage.getTotalPages()).isEqualTo(2);
        assertThat(firstPage.getContent()).extracting(Course::getCode).containsExactly("CS101", "MA101");

        Page<Course> secondPage = courseRepository.findAll(
                Specification.allOf(null, null),
                PageRequest.of(1, 2, Sort.by(Sort.Direction.ASC, "code")));
        assertThat(secondPage.getContent()).extracting(Course::getCode).containsExactly("PH101");
    }

    @Test
    void shouldDeleteCourse() {
        Course saved = courseRepository.saveAndFlush(newCourse("CS101", 6, 1L, CourseStatus.ACTIVE));

        courseRepository.delete(saved);
        courseRepository.flush();

        assertThat(courseRepository.findById(saved.getId())).isEmpty();
    }
}

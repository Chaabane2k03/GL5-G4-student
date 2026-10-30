package tn.fst.courseservice.repository;

import tn.fst.courseservice.entity.Course;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

/**
 * Data access for {@link Course}. {@link JpaSpecificationExecutor} supports the optional
 * {@code departmentId} / {@code status} list filters.
 */
@Repository
public interface CourseRepository extends JpaRepository<Course, Long>, JpaSpecificationExecutor<Course> {

    boolean existsByCode(String code);

    boolean existsByCodeAndIdNot(String code, Long id);
}

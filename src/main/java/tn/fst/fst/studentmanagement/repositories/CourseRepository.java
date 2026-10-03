package tn.fst.studentmanagement.repositories;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import tn.fst.studentmanagement.entities.Course;

@Repository
public interface CourseRepository extends JpaRepository<Course, Long> {}

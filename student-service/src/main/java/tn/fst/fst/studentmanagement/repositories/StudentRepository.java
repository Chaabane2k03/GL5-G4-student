package tn.fst.studentmanagement.repositories;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import tn.fst.studentmanagement.entities.Course;
import tn.fst.studentmanagement.entities.Student;
@Repository
public interface StudentRepository extends JpaRepository<Student, Long> {
}

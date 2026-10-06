package tn.fst.studentmanagement.repositories;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import tn.fst.studentmanagement.entities.Enrollment;
import tn.fst.studentmanagement.entities.Student;
@Repository
public interface EnrollmentRepository extends JpaRepository<Enrollment, Long> {
}

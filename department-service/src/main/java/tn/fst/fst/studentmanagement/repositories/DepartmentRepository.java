package tn.fst.studentmanagement.repositories;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import tn.fst.studentmanagement.entities.Department;
@Repository
public interface DepartmentRepository extends JpaRepository<Department, Long> {}

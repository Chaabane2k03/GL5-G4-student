package tn.fst.departmentservice.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import tn.fst.departmentservice.entity.Department;

public interface DepartmentRepository extends JpaRepository<Department, Long> {
}

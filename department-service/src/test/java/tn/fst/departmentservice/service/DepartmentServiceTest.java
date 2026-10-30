package tn.fst.departmentservice.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tn.fst.departmentservice.controller.DepartmentNotFoundException;
import tn.fst.departmentservice.entity.Department;
import tn.fst.departmentservice.repository.DepartmentRepository;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DepartmentServiceTest {

    @Mock
    private DepartmentRepository departmentRepository;

    @InjectMocks
    private DepartmentService departmentService;

    @Test
    void returnsAllDepartments() {
        List<Department> departments = List.of(new Department(1L, "Computer Science", "Building A", "123", "A. Smith"));
        when(departmentRepository.findAll()).thenReturn(departments);

        assertEquals(departments, departmentService.getAllDepartments());
    }

    @Test
    void returnsDepartmentById() {
        Department department = new Department(2L, "Mathematics", "Building B", "456", "B. Smith");
        when(departmentRepository.findById(2L)).thenReturn(Optional.of(department));

        assertEquals(department, departmentService.getDepartmentById(2L));
    }

    @Test
    void throwsWhenDepartmentDoesNotExist() {
        when(departmentRepository.findById(99L)).thenReturn(Optional.empty());

        assertThrows(DepartmentNotFoundException.class, () -> departmentService.getDepartmentById(99L));
    }

    @Test
    void savesDepartment() {
        Department department = new Department(null, "Physics", "Building C", "789", "C. Smith");
        when(departmentRepository.save(department)).thenReturn(department);

        assertEquals(department, departmentService.saveDepartment(department));
    }

    @Test
    void updatesDepartmentUsingPathId() {
        Department department = new Department(null, "Physics", "Building C", "789", "C. Smith");
        when(departmentRepository.findById(3L)).thenReturn(Optional.of(
                new Department(3L, "Physics", "Building C", "789", "C. Smith")));
        when(departmentRepository.save(department)).thenReturn(department);

        Department updated = departmentService.updateDepartment(3L, department);

        assertEquals(3L, updated.getIdDepartment());
        verify(departmentRepository).save(department);
    }

    @Test
    void deletesExistingDepartment() {
        when(departmentRepository.existsById(4L)).thenReturn(true);

        departmentService.deleteDepartment(4L);

        verify(departmentRepository).deleteById(4L);
    }

    @Test
    void refusesToDeleteMissingDepartment() {
        when(departmentRepository.existsById(5L)).thenReturn(false);

        assertThrows(DepartmentNotFoundException.class, () -> departmentService.deleteDepartment(5L));
    }
}

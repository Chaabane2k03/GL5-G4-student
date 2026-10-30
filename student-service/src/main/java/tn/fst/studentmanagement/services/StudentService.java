package tn.fst.studentmanagement.services;

import feign.FeignException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import tn.fst.studentmanagement.clients.DepartmentClient;
import tn.fst.studentmanagement.entities.Student;
import tn.fst.studentmanagement.exceptions.DepartmentNotFoundException;
import tn.fst.studentmanagement.exceptions.StudentNotFoundException;
import tn.fst.studentmanagement.repositories.StudentRepository;

import java.util.List;

@Service
@RequiredArgsConstructor
public class StudentService implements IStudentService {
    private final StudentRepository studentRepository;
    private final DepartmentClient departmentClient;

    public List<Student> getAllStudents() { return studentRepository.findAll(); }

    public Student getStudentById(Long id) {
        return studentRepository.findById(id).orElseThrow(() -> new StudentNotFoundException(id));
    }

    public Student saveStudent(Student student) {
        validateDepartment(student);
        return studentRepository.save(student);
    }

    public void deleteStudent(Long id) { studentRepository.deleteById(id); }

    /**
     * Cross-service integrity check: when a student is attached to a department, that
     * department must exist in the department-service. A remote 404 is surfaced by Feign
     * as {@link FeignException.NotFound} and translated into a domain exception.
     */
    private void validateDepartment(Student student) {
        if (student.getDepartmentId() == null) {
            return;
        }
        try {
            departmentClient.getDepartment(student.getDepartmentId());
        } catch (FeignException.NotFound ex) {
            throw new DepartmentNotFoundException(student.getDepartmentId());
        }
    }
}

package tn.fst.studentmanagement.cqrs;

import org.axonframework.eventhandling.EventHandler;
import org.axonframework.queryhandling.QueryHandler;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tn.fst.studentmanagement.entities.Student;
import tn.fst.studentmanagement.repositories.StudentRepository;
import tn.fst.studentmanagement.cqrs.StudentCommandsAndEvents.*;

import java.util.List;

@Component
public class StudentProjection {
    private final StudentRepository repository;

    public StudentProjection(StudentRepository repository) { this.repository = repository; }

    @EventHandler
    @Transactional
    public void on(StudentCreatedEvent event) {
        repository.save(new Student(null, event.firstName(), event.lastName(), event.email(),
                event.phone(), event.dateOfBirth(), event.address(), event.departmentId()));
    }

    @EventHandler
    @Transactional
    public void on(StudentUpdatedEvent event) {
        repository.findById(Long.valueOf(event.studentId())).ifPresent(student -> {
            student.setFirstName(event.firstName());
            student.setLastName(event.lastName());
            student.setEmail(event.email());
            student.setPhone(event.phone());
            student.setDateOfBirth(event.dateOfBirth());
            student.setAddress(event.address());
            student.setDepartmentId(event.departmentId());
            repository.save(student);
        });
    }

    @EventHandler
    @Transactional
    public void on(StudentDeletedEvent event) {
        repository.deleteById(Long.valueOf(event.studentId()));
    }

    @QueryHandler
    public List<Student> handle(FindAllStudentsQuery query) { return repository.findAll(); }

    @QueryHandler
    public Student handle(FindStudentQuery query) {
        return repository.findById(query.studentId()).orElseThrow();
    }
}

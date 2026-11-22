package tn.fst.departmentservice.cqrs;

import org.axonframework.eventhandling.EventHandler;
import org.axonframework.queryhandling.QueryHandler;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tn.fst.departmentservice.controller.DepartmentNotFoundException;
import tn.fst.departmentservice.entity.Department;
import tn.fst.departmentservice.repository.DepartmentRepository;
import tn.fst.departmentservice.cqrs.DepartmentCommandsAndEvents.*;

import java.util.List;

@Component
public class DepartmentProjection {
    private final DepartmentRepository repository;

    public DepartmentProjection(DepartmentRepository repository) { this.repository = repository; }

    @EventHandler @Transactional
    public void on(DepartmentCreatedEvent event) {
        repository.save(new Department(null, event.name(), event.location(), event.phone(), event.head()));
    }

    @EventHandler @Transactional
    public void on(DepartmentUpdatedEvent event) {
        repository.findById(Long.valueOf(event.departmentId())).ifPresent(department -> {
            department.setName(event.name());
            department.setLocation(event.location());
            department.setPhone(event.phone());
            department.setHead(event.head());
            repository.save(department);
        });
    }

    @EventHandler @Transactional
    public void on(DepartmentDeletedEvent event) {
        repository.deleteById(Long.valueOf(event.departmentId()));
    }

    @QueryHandler
    public List<Department> handle(FindAllDepartmentsQuery query) { return repository.findAll(); }

    @QueryHandler
    public Department handle(FindDepartmentQuery query) {
        return repository.findById(query.departmentId())
                .orElseThrow(() -> new DepartmentNotFoundException(query.departmentId()));
    }
}

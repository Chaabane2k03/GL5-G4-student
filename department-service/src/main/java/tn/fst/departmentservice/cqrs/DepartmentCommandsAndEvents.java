package tn.fst.departmentservice.cqrs;

import org.axonframework.modelling.command.TargetAggregateIdentifier;

public final class DepartmentCommandsAndEvents {
    private DepartmentCommandsAndEvents() {}

    public record CreateDepartmentCommand(@TargetAggregateIdentifier String departmentId, String name,
                                          String location, String phone, String head) {}
    public record UpdateDepartmentCommand(@TargetAggregateIdentifier String departmentId, String name,
                                          String location, String phone, String head) {}
    public record DeleteDepartmentCommand(@TargetAggregateIdentifier String departmentId) {}
    public record DepartmentCreatedEvent(String departmentId, String name, String location, String phone, String head) {}
    public record DepartmentUpdatedEvent(String departmentId, String name, String location, String phone, String head) {}
    public record DepartmentDeletedEvent(String departmentId) {}
    public record FindDepartmentQuery(Long departmentId) {}
    public record FindAllDepartmentsQuery() {}
}

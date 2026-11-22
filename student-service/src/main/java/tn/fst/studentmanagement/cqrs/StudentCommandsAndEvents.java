package tn.fst.studentmanagement.cqrs;

import org.axonframework.modelling.command.TargetAggregateIdentifier;

public final class StudentCommandsAndEvents {
    private StudentCommandsAndEvents() {}

    public record CreateStudentCommand(@TargetAggregateIdentifier String studentId, String firstName,
                                       String lastName, String email, String phone,
                                       java.time.LocalDate dateOfBirth, String address, Long departmentId) {}
    public record UpdateStudentCommand(@TargetAggregateIdentifier String studentId, String firstName,
                                       String lastName, String email, String phone,
                                       java.time.LocalDate dateOfBirth, String address, Long departmentId) {}
    public record DeleteStudentCommand(@TargetAggregateIdentifier String studentId) {}
    public record StudentCreatedEvent(String studentId, String firstName, String lastName, String email,
                                      String phone, java.time.LocalDate dateOfBirth, String address, Long departmentId) {}
    public record StudentUpdatedEvent(String studentId, String firstName, String lastName, String email,
                                      String phone, java.time.LocalDate dateOfBirth, String address, Long departmentId) {}
    public record StudentDeletedEvent(String studentId) {}
    public record FindStudentQuery(Long studentId) {}
    public record FindAllStudentsQuery() {}
}

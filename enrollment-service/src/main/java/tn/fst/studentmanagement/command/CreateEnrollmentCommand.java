package tn.fst.studentmanagement.command;

import tn.fst.studentmanagement.entities.Status;

import java.time.LocalDate;

public record CreateEnrollmentCommand(
        LocalDate enrollmentDate,
        Double grade,
        Status status,
        Long studentId,
        Long courseId) {
}
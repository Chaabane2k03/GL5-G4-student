package tn.fst.studentmanagement.axon.event;

import tn.fst.studentmanagement.entities.Status;

import java.time.LocalDate;

public record AxonEnrollmentUpdatedEvent(
        String enrollmentId, LocalDate enrollmentDate, Double grade, Status status,
        Long studentId, Long courseId) {
}

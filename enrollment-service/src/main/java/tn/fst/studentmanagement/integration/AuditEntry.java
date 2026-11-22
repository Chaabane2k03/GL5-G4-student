package tn.fst.studentmanagement.integration;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * Result of the demo flow: one row per integration event consumed by the audit listener.
 * The event id is the primary key, so a redelivered message cannot create a duplicate row.
 */
@Entity
@Table(name = "enrollment_audit_log")
public class AuditEntry {

    @Id
    private String eventId;

    @Column(nullable = false)
    private String enrollmentId;

    private String enrollmentDate;
    private Double grade;
    private String status;
    private Long studentId;
    private Long courseId;

    @Column(nullable = false)
    private String occurredAt;

    @Column(nullable = false)
    private Instant receivedAt;

    public AuditEntry() {
    }

    public AuditEntry(EnrollmentCreatedIntegrationEvent event, Instant receivedAt) {
        this.eventId = event.eventId();
        this.enrollmentId = event.enrollmentId();
        this.enrollmentDate = event.enrollmentDate();
        this.grade = event.grade();
        this.status = event.status();
        this.studentId = event.studentId();
        this.courseId = event.courseId();
        this.occurredAt = event.occurredAt();
        this.receivedAt = receivedAt;
    }

    public String getEventId() {
        return eventId;
    }

    public String getEnrollmentId() {
        return enrollmentId;
    }

    public String getEnrollmentDate() {
        return enrollmentDate;
    }

    public Double getGrade() {
        return grade;
    }

    public String getStatus() {
        return status;
    }

    public Long getStudentId() {
        return studentId;
    }

    public Long getCourseId() {
        return courseId;
    }

    public String getOccurredAt() {
        return occurredAt;
    }

    public Instant getReceivedAt() {
        return receivedAt;
    }
}

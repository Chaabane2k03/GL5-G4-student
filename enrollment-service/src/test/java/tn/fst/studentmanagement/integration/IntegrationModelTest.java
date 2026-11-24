package tn.fst.studentmanagement.integration;

import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class IntegrationModelTest {

    @Test
    void auditEntryExposesTheEventItWasBuiltFrom() {
        Instant received = Instant.parse("2026-11-22T10:00:00Z");
        EnrollmentCreatedIntegrationEvent event = new EnrollmentCreatedIntegrationEvent(
                "evt-1", "42", "2026-11-22", 12.5, "ACTIVE", 7L, 3L, "2026-11-22T09:59:00Z");

        AuditEntry entry = new AuditEntry(event, received);

        assertThat(entry.getEventId()).isEqualTo("evt-1");
        assertThat(entry.getEnrollmentId()).isEqualTo("42");
        assertThat(entry.getEnrollmentDate()).isEqualTo("2026-11-22");
        assertThat(entry.getGrade()).isEqualTo(12.5);
        assertThat(entry.getStatus()).isEqualTo("ACTIVE");
        assertThat(entry.getStudentId()).isEqualTo(7L);
        assertThat(entry.getCourseId()).isEqualTo(3L);
        assertThat(entry.getOccurredAt()).isEqualTo("2026-11-22T09:59:00Z");
        assertThat(entry.getReceivedAt()).isEqualTo(received);
        assertThat(new AuditEntry().getEventId()).isNull();
    }

    @Test
    void outboxEventExposesItsPayloadAndPublicationState() {
        Instant created = Instant.parse("2026-11-22T10:00:00Z");
        Instant published = Instant.parse("2026-11-22T10:00:02Z");
        OutboxEvent event = new OutboxEvent("evt-1", "enrollment.created", "{}", created);

        assertThat(event.getEventId()).isEqualTo("evt-1");
        assertThat(event.getRoutingKey()).isEqualTo("enrollment.created");
        assertThat(event.getPayload()).isEqualTo("{}");
        assertThat(event.getCreatedAt()).isEqualTo(created);
        assertThat(event.getPublishedAt()).isNull();

        event.markPublished(published);

        assertThat(event.getPublishedAt()).isEqualTo(published);
        assertThat(new OutboxEvent().getEventId()).isNull();
    }
}

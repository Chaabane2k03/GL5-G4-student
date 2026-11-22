package tn.fst.studentmanagement.integration;

/**
 * Stable event published to RabbitMQ when an enrollment is created.
 *
 * <p>This is deliberately separate from {@code AxonEnrollmentCreatedEvent}: the Axon event is
 * internal to the service (and stored by Axon Server), whereas this one is the public contract
 * other services may rely on. Dates are ISO strings so the JSON payload does not depend on a
 * Jackson Java-time configuration.
 */
public record EnrollmentCreatedIntegrationEvent(
        String eventId,
        String enrollmentId,
        String enrollmentDate,
        Double grade,
        String status,
        Long studentId,
        Long courseId,
        String occurredAt) {
}

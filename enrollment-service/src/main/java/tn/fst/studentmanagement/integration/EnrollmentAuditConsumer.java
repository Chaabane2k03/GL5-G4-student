package tn.fst.studentmanagement.integration;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

/**
 * Audit consumer for the demo flow. Idempotent by primary key: RabbitMQ is at-least-once, so the
 * same event id may arrive twice (e.g. publisher restarted before marking the outbox row).
 */
@Component
@ConditionalOnProperty(name = "enrollment.events.enabled", havingValue = "true")
public class EnrollmentAuditConsumer {

    private final AuditEntryRepository repository;
    private final ObjectMapper objectMapper;

    public EnrollmentAuditConsumer(AuditEntryRepository repository, ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    @RabbitListener(queues = RabbitMQConfig.AUDIT_QUEUE)
    @Transactional
    public void onMessage(String payload) {
        EnrollmentCreatedIntegrationEvent event;
        try {
            event = objectMapper.readValue(payload, EnrollmentCreatedIntegrationEvent.class);
        } catch (JsonProcessingException e) {
            // Throwing makes the retry interceptor kick in; after 3 attempts the message is
            // dead-lettered instead of blocking the queue forever.
            throw new IllegalArgumentException("Invalid enrollment.created payload", e);
        }

        if (repository.existsById(event.eventId())) {
            return;
        }
        repository.save(new AuditEntry(event, Instant.now()));
    }
}

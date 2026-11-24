package tn.fst.studentmanagement.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessagePostProcessor;
import org.springframework.amqp.core.MessageProperties;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.data.domain.Pageable;
import tn.fst.studentmanagement.clients.CourseClient;
import tn.fst.studentmanagement.clients.StudentClient;
import tn.fst.studentmanagement.command.CreateEnrollmentCommand;
import tn.fst.studentmanagement.command.EnrollmentCommandService;
import tn.fst.studentmanagement.entities.Enrollment;
import tn.fst.studentmanagement.entities.Status;
import tn.fst.studentmanagement.repositories.EnrollmentRepository;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for the demo async flow. No Spring context and no RabbitMQ broker are needed:
 * the outbox row is written in the command service's transaction, the publisher is called
 * directly, and the consumer is invoked directly.
 */
class AsyncEnrollmentFlowTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private static CreateEnrollmentCommand createCommand() {
        return new CreateEnrollmentCommand(LocalDate.of(2026, 11, 22), 12.5, Status.ACTIVE, 1L, 2L);
    }

    private static EnrollmentCommandService service(EnrollmentRepository enrollments,
                                                    OutboxEventRepository outbox,
                                                    boolean eventsEnabled) {
        when(enrollments.save(any(Enrollment.class))).thenAnswer(invocation -> {
            Enrollment saved = invocation.getArgument(0);
            saved.setIdEnrollment(42L);
            return saved;
        });
        return new EnrollmentCommandService(enrollments, mock(StudentClient.class),
                mock(CourseClient.class), outbox, MAPPER, eventsEnabled);
    }

    @Test
    void createWritesOutboxRowWhenFlowIsEnabled() {
        EnrollmentRepository enrollments = mock(EnrollmentRepository.class);
        OutboxEventRepository outbox = mock(OutboxEventRepository.class);

        service(enrollments, outbox, true).create(createCommand());

        verify(enrollments).save(any(Enrollment.class));
        ArgumentCaptor<OutboxEvent> captor = ArgumentCaptor.forClass(OutboxEvent.class);
        verify(outbox).save(captor.capture());
        OutboxEvent row = captor.getValue();
        assertThat(row.getRoutingKey()).isEqualTo("enrollment.created");
        assertThat(row.getPayload()).contains("\"enrollmentId\":\"42\"");
        assertThat(row.getPayload()).contains("\"studentId\":1");
        assertThat(row.getEventId()).isNotBlank();
    }

    @Test
    void createDoesNotWriteOutboxRowWhenFlowIsDisabled() {
        EnrollmentRepository enrollments = mock(EnrollmentRepository.class);
        OutboxEventRepository outbox = mock(OutboxEventRepository.class);

        service(enrollments, outbox, false).create(createCommand());

        verify(enrollments).save(any(Enrollment.class));
        verify(outbox, never()).save(any());
    }

    @Test
    void publisherPublishesAndMarksOutboxRow() {
        OutboxEventRepository outbox = mock(OutboxEventRepository.class);
        RabbitTemplate template = mock(RabbitTemplate.class);
        OutboxEvent row = new OutboxEvent("evt-1", "enrollment.created", "{}", Instant.now());
        when(outbox.findByPublishedAtIsNullOrderByCreatedAtAsc(any(Pageable.class)))
                .thenReturn(List.of(row));

        new OutboxPublisher(outbox, template).publishPending();

        ArgumentCaptor<MessagePostProcessor> headers = ArgumentCaptor.forClass(MessagePostProcessor.class);
        verify(template).convertAndSend(eq("enrollment.events"), eq("enrollment.created"),
                eq("{}"), headers.capture());
        assertThat(row.getPublishedAt()).isNotNull();
        verify(outbox).save(row);

        Message message = mock(Message.class);
        MessageProperties properties = mock(MessageProperties.class);
        when(message.getMessageProperties()).thenReturn(properties);
        assertThat(headers.getValue().postProcessMessage(message)).isSameAs(message);
        verify(properties).setContentType("application/json");
        verify(properties).setHeader("eventId", "evt-1");
    }

    @Test
    void consumerStoresEventOnceAndIgnoresRedelivery() throws Exception {
        AuditEntryRepository audit = mock(AuditEntryRepository.class);
        EnrollmentCreatedIntegrationEvent event = new EnrollmentCreatedIntegrationEvent(
                "evt-1", "42", "2026-11-22", 12.5, "ACTIVE", 1L, 2L, "2026-11-22T10:00:00Z");
        String payload = MAPPER.writeValueAsString(event);
        EnrollmentAuditConsumer consumer = new EnrollmentAuditConsumer(audit, MAPPER);

        when(audit.existsById("evt-1")).thenReturn(false, true);
        consumer.onMessage(payload);
        consumer.onMessage(payload); // simulate at-least-once redelivery

        ArgumentCaptor<AuditEntry> captor = ArgumentCaptor.forClass(AuditEntry.class);
        verify(audit).save(captor.capture());
        assertThat(captor.getValue().getEnrollmentId()).isEqualTo("42");
        assertThat(captor.getValue().getStudentId()).isEqualTo(1L);
        assertThat(captor.getValue().getReceivedAt()).isNotNull();
    }

    @Test
    void consumerRejectsMalformedPayloadSoItCanBeDeadLettered() {
        AuditEntryRepository audit = mock(AuditEntryRepository.class);
        EnrollmentAuditConsumer consumer = new EnrollmentAuditConsumer(audit, MAPPER);

        Assertions.assertThrows(IllegalArgumentException.class,
                () -> consumer.onMessage("not-json"));
        verify(audit, never()).save(any());
    }
}

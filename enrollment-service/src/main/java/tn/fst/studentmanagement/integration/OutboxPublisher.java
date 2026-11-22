package tn.fst.studentmanagement.integration;

import org.springframework.amqp.core.MessagePostProcessor;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

/**
 * Drains the outbox into RabbitMQ.
 *
 * <p>Delivery is at-least-once: we publish first and only then mark the row as published. If the
 * process dies in between, the message is republished — which is why the consumer is idempotent.
 */
@Component
@ConditionalOnProperty(name = "enrollment.events.enabled", havingValue = "true")
public class OutboxPublisher {

    private static final int BATCH_SIZE = 50;

    private final OutboxEventRepository repository;
    private final RabbitTemplate rabbitTemplate;

    public OutboxPublisher(OutboxEventRepository repository, RabbitTemplate rabbitTemplate) {
        this.repository = repository;
        this.rabbitTemplate = rabbitTemplate;
    }

    @Scheduled(fixedDelayString = "${enrollment.events.publish-interval:2000}")
    @Transactional
    public void publishPending() {
        List<OutboxEvent> pending = repository
                .findByPublishedAtIsNullOrderByCreatedAtAsc(PageRequest.of(0, BATCH_SIZE));

        for (OutboxEvent outbox : pending) {
            MessagePostProcessor headers = message -> {
                message.getMessageProperties().setContentType("application/json");
                message.getMessageProperties().setHeader("eventId", outbox.getEventId());
                return message;
            };
            rabbitTemplate.convertAndSend(RabbitMQConfig.EXCHANGE, outbox.getRoutingKey(),
                    outbox.getPayload(), headers);
            outbox.markPublished(Instant.now());
            repository.save(outbox);
        }
    }
}

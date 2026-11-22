package tn.fst.studentmanagement.integration;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * A message waiting to be published. It is written in the SAME database transaction as the
 * enrollment projection, which is what makes the delivery reliable: either both are committed
 * or neither is.
 */
@Entity
@Table(name = "enrollment_outbox")
public class OutboxEvent {

    @Id
    private String eventId;

    @Column(nullable = false)
    private String routingKey;

    @Column(nullable = false, length = 2048)
    private String payload;

    @Column(nullable = false)
    private Instant createdAt;

    private Instant publishedAt;

    public OutboxEvent() {
    }

    public OutboxEvent(String eventId, String routingKey, String payload, Instant createdAt) {
        this.eventId = eventId;
        this.routingKey = routingKey;
        this.payload = payload;
        this.createdAt = createdAt;
    }

    public void markPublished(Instant publishedAt) {
        this.publishedAt = publishedAt;
    }

    public String getEventId() {
        return eventId;
    }

    public String getRoutingKey() {
        return routingKey;
    }

    public String getPayload() {
        return payload;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getPublishedAt() {
        return publishedAt;
    }
}

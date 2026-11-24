package tn.fst.studentmanagement.integration;

import org.junit.jupiter.api.Test;
import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.rabbit.config.SimpleRabbitListenerContainerFactory;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class RabbitMQConfigTest {

    private final RabbitMQConfig config = new RabbitMQConfig();

    @Test
    void declaresTheAuditTopology() {
        TopicExchange exchange = config.enrollmentEventsExchange();
        Queue audit = config.enrollmentAuditQueue();
        Binding binding = config.enrollmentAuditBinding();

        assertThat(exchange.getName()).isEqualTo(RabbitMQConfig.EXCHANGE);
        assertThat(audit.getName()).isEqualTo(RabbitMQConfig.AUDIT_QUEUE);
        assertThat(audit.getArguments().get("x-dead-letter-exchange")).isEqualTo(RabbitMQConfig.DLX);
        assertThat(audit.getArguments().get("x-dead-letter-routing-key"))
                .isEqualTo(RabbitMQConfig.DLQ_ROUTING_KEY);
        assertThat(binding.getRoutingKey()).isEqualTo(RabbitMQConfig.ROUTING_KEY);
        assertThat(binding.getDestination()).isEqualTo(RabbitMQConfig.AUDIT_QUEUE);
    }

    @Test
    void declaresTheDeadLetterTopology() {
        TopicExchange dlx = config.enrollmentDeadLetterExchange();
        Queue dlq = config.enrollmentDeadLetterQueue();
        Binding binding = config.enrollmentDeadLetterBinding();

        assertThat(dlx.getName()).isEqualTo(RabbitMQConfig.DLX);
        assertThat(dlq.getName()).isEqualTo(RabbitMQConfig.DLQ);
        assertThat(binding.getRoutingKey()).isEqualTo(RabbitMQConfig.DLQ_ROUTING_KEY);
    }

    @Test
    void configuresRetryForFailedAuditDeliveries() {
        SimpleRabbitListenerContainerFactory factory =
                config.rabbitListenerContainerFactory(mock(ConnectionFactory.class));

        assertThat(factory).isNotNull();
        assertThat(factory.getAdviceChain()).isNotEmpty();
    }
}

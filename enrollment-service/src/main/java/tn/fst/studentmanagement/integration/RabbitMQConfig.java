package tn.fst.studentmanagement.integration;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.rabbit.annotation.EnableRabbit;
import org.springframework.amqp.rabbit.config.RetryInterceptorBuilder;
import org.springframework.amqp.rabbit.config.SimpleRabbitListenerContainerFactory;
import org.springframework.amqp.rabbit.connection.CachingConnectionFactory;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.rabbit.retry.RejectAndDontRequeueRecoverer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Topology for the single demo flow:
 *
 * <pre>
 * enrollment.events (topic)
 *        |-- enrollment.created --&gt; enrollment.audit
 *                                      | (3 failed attempts, no requeue)
 *                                      v
 *                            enrollment.dlx (topic)
 *                                      |-- enrollment.audit.failed --&gt; enrollment.dlq
 * </pre>
 *
 * <p>All beans are conditional, so running the service locally or in tests does not require a
 * broker. Only docker-compose enables the flow.
 */
@Configuration
@EnableRabbit
@ConditionalOnProperty(name = "enrollment.events.enabled", havingValue = "true")
public class RabbitMQConfig {

    public static final String EXCHANGE = "enrollment.events";
    public static final String ROUTING_KEY = "enrollment.created";
    public static final String AUDIT_QUEUE = "enrollment.audit";
    public static final String DLX = "enrollment.dlx";
    public static final String DLQ = "enrollment.dlq";
    public static final String DLQ_ROUTING_KEY = "enrollment.audit.failed";

    /* Boot 4 no longer auto-configures spring-rabbit, so wire the classic client explicitly. */
    @Bean
    ConnectionFactory rabbitConnectionFactory(
            @Value("${spring.rabbitmq.host:localhost}") String host,
            @Value("${spring.rabbitmq.port:5672}") int port,
            @Value("${spring.rabbitmq.username:guest}") String username,
            @Value("${spring.rabbitmq.password:guest}") String password,
            @Value("${spring.rabbitmq.virtual-host:/}") String virtualHost) {
        CachingConnectionFactory factory = new CachingConnectionFactory(host, port);
        factory.setUsername(username);
        factory.setPassword(password);
        factory.setVirtualHost(virtualHost);
        return factory;
    }

    @Bean
    RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory) {
        return new RabbitTemplate(connectionFactory);
    }

    @Bean
    TopicExchange enrollmentEventsExchange() {
        return new TopicExchange(EXCHANGE);
    }

    @Bean
    Queue enrollmentAuditQueue() {
        return QueueBuilder.durable(AUDIT_QUEUE)
                .deadLetterExchange(DLX)
                .deadLetterRoutingKey(DLQ_ROUTING_KEY)
                .build();
    }

    @Bean
    Binding enrollmentAuditBinding() {
        return BindingBuilder.bind(enrollmentAuditQueue())
                .to(enrollmentEventsExchange())
                .with(ROUTING_KEY);
    }

    @Bean
    TopicExchange enrollmentDeadLetterExchange() {
        return new TopicExchange(DLX);
    }

    @Bean
    Queue enrollmentDeadLetterQueue() {
        return QueueBuilder.durable(DLQ).build();
    }

    @Bean
    Binding enrollmentDeadLetterBinding() {
        return BindingBuilder.bind(enrollmentDeadLetterQueue())
                .to(enrollmentDeadLetterExchange())
                .with(DLQ_ROUTING_KEY);
    }

    /**
     * Retry with exponential backoff, then reject without requeueing so RabbitMQ moves the
     * message to the DLX. Without this, a poison message would loop forever.
     */
    @Bean
    SimpleRabbitListenerContainerFactory rabbitListenerContainerFactory(ConnectionFactory connectionFactory) {
        SimpleRabbitListenerContainerFactory factory = new SimpleRabbitListenerContainerFactory();
        factory.setConnectionFactory(connectionFactory);
        factory.setAdviceChain(RetryInterceptorBuilder.stateless()
                .maxRetries(2) // initial delivery + 2 retries = 3 attempts
                .backOffOptions(1_000, 2.0, 5_000)
                .recoverer(new RejectAndDontRequeueRecoverer())
                .build());
        return factory;
    }
}

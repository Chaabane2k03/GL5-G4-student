package tn.fst.course.config;

import io.micrometer.core.instrument.config.MeterFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Keeps the Prometheus metric registry consistent for {@code http.client.requests}.
 *
 * <p>{@code feign-micrometer} registers the Feign client calls under the same metric name
 * as Spring Boot's own HTTP client instrumentation ({@code http.client.requests}) but with
 * a different set of tag keys ({@code clientName}, {@code http_method},
 * {@code http_status_code}, {@code http_url}). Prometheus refuses to expose two meters
 * that share a name but differ in their tag keys, so the Feign meter is rejected with a
 * warning and the Feign client metrics are lost.</p>
 *
 * <p>Denying the Feign meters up front keeps Spring Boot's canonical variant - the one
 * every other service of the platform exposes - intact and removes the warning. Feign
 * calls stay observable through the distributed traces: they produce a CLIENT span that
 * is exported to Jaeger and a SERVER span in the called service.</p>
 */
@Configuration
public class ObservabilityConfig {

    /**
     * Rejects the Feign variant of {@code http.client.requests} before it reaches the
     * Prometheus registry.
     */
    @Bean
    MeterFilter denyDuplicateFeignClientMeters() {
        return MeterFilter.deny(id -> "http.client.requests".equals(id.getName())
                && id.getTag("clientName") != null);
    }
}

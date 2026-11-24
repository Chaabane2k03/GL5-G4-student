package tn.fst.studentmanagement.config;

import io.micrometer.core.instrument.Meter;
import io.micrometer.core.instrument.Tags;
import io.micrometer.core.instrument.config.MeterFilter;
import io.micrometer.core.instrument.config.MeterFilterReply;
import io.swagger.v3.oas.models.OpenAPI;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ServiceConfigurationTest {

    @Test
    void exposesConfiguredOpenApiMetadata() {
        OpenAPI api = new OpenApiConfig("Enrollment Service API", "v2", "CQRS API")
                .enrollmentServiceOpenAPI();

        assertThat(api.getInfo().getTitle()).isEqualTo("Enrollment Service API");
        assertThat(api.getInfo().getVersion()).isEqualTo("v2");
        assertThat(api.getInfo().getDescription()).isEqualTo("CQRS API");
    }

    @Test
    void deniesOnlyTheDuplicateFeignHttpClientMeter() {
        MeterFilter filter = new ObservabilityConfig().denyDuplicateFeignClientMeters();

        Meter.Id feign = new Meter.Id("http.client.requests",
                Tags.of("clientName", "student-service"), null, null, Meter.Type.COUNTER);
        Meter.Id canonical = new Meter.Id("http.client.requests",
                Tags.of("outcome", "SUCCESS"), null, null, Meter.Type.COUNTER);
        Meter.Id other = new Meter.Id("http.server.requests",
                Tags.of("clientName", "student-service"), null, null, Meter.Type.COUNTER);

        assertThat(filter.accept(feign)).isEqualTo(MeterFilterReply.DENY);
        assertThat(filter.accept(canonical)).isEqualTo(MeterFilterReply.NEUTRAL);
        assertThat(filter.accept(other)).isEqualTo(MeterFilterReply.NEUTRAL);
    }

    @Test
    void feignConfigurationCanBeInstantiated() {
        assertThat(new FeignConfig()).isNotNull();
    }
}

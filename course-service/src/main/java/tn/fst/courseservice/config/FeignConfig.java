package tn.fst.courseservice.config;

import org.springframework.cloud.openfeign.EnableFeignClients;
import org.springframework.context.annotation.Configuration;

/**
 * Enables declarative OpenFeign clients for this service.
 *
 * <p>Keeping {@link EnableFeignClients} on a dedicated configuration class (rather than on
 * the {@code @SpringBootApplication} class) keeps the Feign clients out of the web slice,
 * so {@code @WebMvcTest} tests do not try to build them.</p>
 */
@Configuration
@EnableFeignClients(basePackages = "tn.fst.courseservice.client")
public class FeignConfig {
}

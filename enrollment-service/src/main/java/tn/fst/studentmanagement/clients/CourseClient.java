package tn.fst.studentmanagement.clients;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import tn.fst.studentmanagement.dto.CourseDto;

/**
 * Feign mapping of the course-service REST API.
 *
 * <p>The {@code name} is the Eureka service id, so the call is load-balanced across the
 * registered {@code course-service} instances. {@code path} mirrors the service's
 * {@code server.servlet.context-path}.</p>
 *
 * <p>{@code url} is normally empty, which keeps the load-balanced (Eureka) behaviour.
 * When {@code course.service.url} is set - the {@code kubernetes} profile points it at
 * the in-cluster Service, overridable with the {@code COURSE_SERVICE_URL} environment
 * variable - Feign calls that address directly and no registry is needed.</p>
 */
@FeignClient(name = "course-service", path = "/course", url = "${course.service.url:}")
public interface CourseClient {

    @GetMapping("/api/courses/{id}")
    CourseDto getCourse(@PathVariable("id") Long id);
}

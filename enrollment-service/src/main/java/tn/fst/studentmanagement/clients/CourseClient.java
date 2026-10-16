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
 */
@FeignClient(name = "course-service", path = "/course")
public interface CourseClient {

    @GetMapping("/api/courses/{id}")
    CourseDto getCourse(@PathVariable("id") Long id);
}

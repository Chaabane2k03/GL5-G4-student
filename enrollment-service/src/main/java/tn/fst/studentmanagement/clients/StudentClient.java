package tn.fst.studentmanagement.clients;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import tn.fst.studentmanagement.dto.StudentDto;

/**
 * Feign mapping of the student-service REST API.
 *
 * <p>The {@code name} is the Eureka service id, so the call is load-balanced across the
 * registered {@code student-service} instances. {@code path} mirrors the service's
 * {@code server.servlet.context-path}.</p>
 */
@FeignClient(name = "student-service", path = "/student")
public interface StudentClient {

    @GetMapping("/students/getStudent/{id}")
    StudentDto getStudent(@PathVariable("id") Long id);
}

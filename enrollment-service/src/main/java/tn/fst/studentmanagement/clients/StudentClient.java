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
 *
 * <p>{@code url} is normally empty, which keeps the load-balanced (Eureka) behaviour.
 * When {@code student.service.url} is set - the {@code kubernetes} profile points it at
 * the in-cluster Service, overridable with the {@code STUDENT_SERVICE_URL} environment
 * variable - Feign calls that address directly and no registry is needed.</p>
 */
@FeignClient(name = "student-service", path = "/student", url = "${student.service.url:}")
public interface StudentClient {

    @GetMapping("/students/getStudent/{id}")
    StudentDto getStudent(@PathVariable("id") Long id);
}

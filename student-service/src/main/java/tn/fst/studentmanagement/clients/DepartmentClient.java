package tn.fst.studentmanagement.clients;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import tn.fst.studentmanagement.dto.DepartmentDto;

/**
 * Feign mapping of the department-service REST API.
 *
 * <p>The {@code name} is the Eureka service id, so the call is load-balanced across the
 * registered {@code department-service} instances. {@code path} mirrors the service's
 * {@code server.servlet.context-path}.</p>
 */
@FeignClient(name = "department-service", path = "/department")
public interface DepartmentClient {

    @GetMapping("/api/departments/{id}")
    DepartmentDto getDepartment(@PathVariable("id") Long id);
}

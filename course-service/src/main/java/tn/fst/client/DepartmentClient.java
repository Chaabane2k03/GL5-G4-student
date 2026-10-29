package tn.fst.course.client;

import tn.fst.course.dto.DepartmentDto;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

/**
 * Feign mapping of the department-service REST API.
 *
 * <p>The {@code name} is the Eureka service id, so the call is load-balanced across the
 * registered {@code department-service} instances. {@code path} mirrors the service's
 * {@code server.servlet.context-path}.</p>
 *
 * <p>{@code url} is normally empty, which keeps the load-balanced (Eureka) behaviour.
 * When {@code department.service.url} is set - the {@code kubernetes} profile points it
 * at the in-cluster Service, overridable with the {@code DEPARTMENT_SERVICE_URL}
 * environment variable - Feign calls that address directly and no registry is needed.</p>
 */
@FeignClient(name = "department-service", path = "/department", url = "${department.service.url:}")
public interface DepartmentClient {

    @GetMapping("/api/departments/{id}")
    DepartmentDto getDepartment(@PathVariable("id") Long id);
}

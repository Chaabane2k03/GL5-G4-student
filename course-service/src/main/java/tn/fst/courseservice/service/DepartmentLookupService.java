package tn.fst.courseservice.service;

import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.ratelimiter.annotation.RateLimiter;
import io.github.resilience4j.retry.annotation.Retry;
import org.springframework.stereotype.Service;
import tn.fst.courseservice.client.DepartmentClient;
import tn.fst.courseservice.dto.DepartmentDto;
import tn.fst.courseservice.exception.DepartmentServiceUnavailableException;

/**
 * Resilient boundary around the synchronous department-service dependency.
 */
@Service
public class DepartmentLookupService {

    private final DepartmentClient departmentClient;

    public DepartmentLookupService(DepartmentClient departmentClient) {
        this.departmentClient = departmentClient;
    }

    @Retry(name = "departmentService")
    @RateLimiter(name = "departmentService")
    @CircuitBreaker(name = "departmentService", fallbackMethod = "departmentFallback")
    public DepartmentDto getDepartment(Long departmentId) {
        return departmentClient.getDepartment(departmentId);
    }

    private DepartmentDto departmentFallback(Long departmentId, Throwable cause) {
        throw new DepartmentServiceUnavailableException(departmentId);
    }
}

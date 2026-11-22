package tn.fst.studentmanagement.controllers;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.axonframework.messaging.responsetypes.ResponseTypes;
import org.axonframework.queryhandling.QueryGateway;
import org.springframework.web.bind.annotation.*;
import tn.fst.studentmanagement.axon.projection.AxonEnrollmentView;
import tn.fst.studentmanagement.axon.query.FindAllAxonEnrollmentsQuery;
import tn.fst.studentmanagement.axon.query.FindAxonEnrollmentQuery;
import tn.fst.studentmanagement.integration.AuditEntry;
import tn.fst.studentmanagement.integration.AuditEntryRepository;
import tn.fst.studentmanagement.exceptions.EnrollmentNotFoundException;
import tn.fst.studentmanagement.query.EnrollmentQueryService;
import tn.fst.studentmanagement.query.EnrollmentResponse;

import java.util.List;
import java.util.concurrent.CompletionException;

/** Read endpoints only (GET). */
@RestController
@RequestMapping("/Enrollment")
@Tag(name = "Enrollment Queries",
        description = "Read side of the enrollment API: classic queries and Axon projection queries.")
public class EnrollmentQueryController {

    private final EnrollmentQueryService queryService;
    private final QueryGateway queryGateway;
    private final AuditEntryRepository auditEntryRepository;

    public EnrollmentQueryController(EnrollmentQueryService queryService,
                                     QueryGateway queryGateway,
                                     AuditEntryRepository auditEntryRepository) {
        this.queryService = queryService;
        this.queryGateway = queryGateway;
        this.auditEntryRepository = auditEntryRepository;
    }

    @Operation(summary = "List all enrollments")
    @GetMapping("/getAllEnrollment")
    public List<EnrollmentResponse> getAllEnrollment() {
        return queryService.getAll();
    }

    @Operation(summary = "Get an enrollment by id")
    @GetMapping("/getEnrollment/{id}")
    public EnrollmentResponse getEnrollment(
            @Parameter(description = "Id of the enrollment", example = "1") @PathVariable Long id) {
        return queryService.getById(id);
    }

    @Operation(summary = "List enrollments of a student")
    @GetMapping("/student/{studentId}")
    public List<EnrollmentResponse> getByStudent(
            @Parameter(description = "Id of the student") @PathVariable Long studentId) {
        return queryService.getByStudent(studentId);
    }

    @Operation(summary = "List enrollments of a course")
    @GetMapping("/course/{courseId}")
    public List<EnrollmentResponse> getByCourse(
            @Parameter(description = "Id of the course") @PathVariable Long courseId) {
        return queryService.getByCourse(courseId);
    }

    @Operation(summary = "List Axon enrollment projections",
            description = "Reads all enrollments from the Axon query side.")
    @GetMapping("/axon")
    public List<AxonEnrollmentView> getAxonEnrollments() {
        return queryGateway.query(new FindAllAxonEnrollmentsQuery(),
                ResponseTypes.multipleInstancesOf(AxonEnrollmentView.class)).join();
    }

    @Operation(summary = "Get an Axon enrollment projection",
            description = "Reads one enrollment from the Axon query side by aggregate id.")
    @GetMapping("/axon/{id}")
    public AxonEnrollmentView getAxonEnrollment(
            @Parameter(description = "Axon aggregate id") @PathVariable String id) {
        try {
            return queryGateway.query(new FindAxonEnrollmentQuery(id), AxonEnrollmentView.class).join();
        } catch (CompletionException exception) {
            // Axon wraps a not-found query handler exception; map it to the same
            // 404 ProblemDetail used by the JPA read endpoints.
            Throwable root = exception;
            while (root.getCause() != null) {
                root = root.getCause();
            }
            if (root.getMessage() != null && root.getMessage().contains("not found")) {
                throw new EnrollmentNotFoundException(root.getMessage());
            }
            throw exception;
        }
    }

    @Operation(summary = "List audit entries delivered through RabbitMQ (demo)",
            description = "Eventually consistent: a row appears after the outbox publisher and "
                    + "the audit consumer have run. Returns an empty list when the async flow is disabled.")
    @GetMapping("/audit")
    public List<AuditEntry> getAuditEntries() {
        return auditEntryRepository.findAll();
    }
}

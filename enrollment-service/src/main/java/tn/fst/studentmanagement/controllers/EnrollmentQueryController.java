package tn.fst.studentmanagement.controllers;

import tn.fst.studentmanagement.axon.projection.AxonEnrollmentView;
import tn.fst.studentmanagement.axon.query.FindAllAxonEnrollmentsQuery;
import tn.fst.studentmanagement.axon.query.FindAxonEnrollmentQuery;
import org.axonframework.queryhandling.QueryGateway;
import org.axonframework.messaging.responsetypes.ResponseTypes;
import org.springframework.web.bind.annotation.*;
import tn.fst.studentmanagement.query.EnrollmentQueryService;
import tn.fst.studentmanagement.query.EnrollmentResponse;

import java.util.List;

/** Read endpoints only (GET). */
@RestController
@RequestMapping("/Enrollment")
public class EnrollmentQueryController {

    private final EnrollmentQueryService queryService;
    private final QueryGateway queryGateway;

    public EnrollmentQueryController(EnrollmentQueryService queryService,
                                     QueryGateway queryGateway) {
        this.queryService = queryService;
        this.queryGateway = queryGateway;
    }

    @GetMapping("/getAllEnrollment")
    public List<EnrollmentResponse> getAllEnrollment() {
        return queryService.getAll();
    }

    @GetMapping("/getEnrollment/{id}")
    public EnrollmentResponse getEnrollment(@PathVariable Long id) {
        return queryService.getById(id);
    }

    @GetMapping("/student/{studentId}")
    public List<EnrollmentResponse> getByStudent(@PathVariable Long studentId) {
        return queryService.getByStudent(studentId);
    }

    @GetMapping("/course/{courseId}")
    public List<EnrollmentResponse> getByCourse(@PathVariable Long courseId) {
        return queryService.getByCourse(courseId);
    }

    @GetMapping("/axon")
    public List<AxonEnrollmentView> getAxonEnrollments() {
        return queryGateway.query(new FindAllAxonEnrollmentsQuery(), ResponseTypes.multipleInstancesOf(AxonEnrollmentView.class))
                .join();
    }

    @GetMapping("/axon/{id}")
    public AxonEnrollmentView getAxonEnrollment(@PathVariable String id) {
        return queryGateway.query(new FindAxonEnrollmentQuery(id), AxonEnrollmentView.class).join();
    }
}
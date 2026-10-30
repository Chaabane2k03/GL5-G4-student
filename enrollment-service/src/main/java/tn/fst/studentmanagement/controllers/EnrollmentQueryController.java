package tn.fst.studentmanagement.controllers;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import tn.fst.studentmanagement.query.EnrollmentQueryService;
import tn.fst.studentmanagement.query.EnrollmentResponse;

import java.util.List;

/** Read endpoints only (GET). */
@RestController
@RequestMapping("/Enrollment")
@RequiredArgsConstructor
public class EnrollmentQueryController {

    private final EnrollmentQueryService queryService;

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
}
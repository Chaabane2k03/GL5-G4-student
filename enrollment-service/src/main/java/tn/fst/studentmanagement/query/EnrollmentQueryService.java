package tn.fst.studentmanagement.query;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tn.fst.studentmanagement.exceptions.EnrollmentNotFoundException;
import tn.fst.studentmanagement.repositories.EnrollmentRepository;

import java.util.List;

/**
 * Read side of the enrollment service (CQRS). Read-only transactions, no state changes,
 * and entities are never exposed: everything is mapped to {@link EnrollmentResponse}.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class EnrollmentQueryService {

    private final EnrollmentRepository enrollmentRepository;

    public List<EnrollmentResponse> getAll() {
        return enrollmentRepository.findAll().stream()
                .map(EnrollmentResponse::from)
                .toList();
    }

    public EnrollmentResponse getById(Long idEnrollment) {
        return enrollmentRepository.findById(idEnrollment)
                .map(EnrollmentResponse::from)
                .orElseThrow(() -> new EnrollmentNotFoundException(idEnrollment));
    }

    public List<EnrollmentResponse> getByStudent(Long studentId) {
        return enrollmentRepository.findByStudentId(studentId).stream()
                .map(EnrollmentResponse::from)
                .toList();
    }

    public List<EnrollmentResponse> getByCourse(Long courseId) {
        return enrollmentRepository.findByCourseId(courseId).stream()
                .map(EnrollmentResponse::from)
                .toList();
    }
}
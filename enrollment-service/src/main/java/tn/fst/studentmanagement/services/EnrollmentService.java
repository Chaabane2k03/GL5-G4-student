package tn.fst.studentmanagement.services;

import feign.FeignException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import tn.fst.studentmanagement.clients.CourseClient;
import tn.fst.studentmanagement.clients.StudentClient;
import tn.fst.studentmanagement.entities.Enrollment;
import tn.fst.studentmanagement.exceptions.CourseNotFoundException;
import tn.fst.studentmanagement.exceptions.StudentNotFoundException;
import tn.fst.studentmanagement.repositories.EnrollmentRepository;

import java.util.List;

@Service
public class EnrollmentService implements IEnrollment {
    @Autowired
    EnrollmentRepository enrollmentRepository;

    @Autowired
    StudentClient studentClient;

    @Autowired
    CourseClient courseClient;

    @Override
    public List<Enrollment> getAllEnrollments() {
        return enrollmentRepository.findAll();
    }

    @Override
    public Enrollment getEnrollmentById(Long idEnrollment) {
        return enrollmentRepository.findById(idEnrollment).get();
    }

    @Override
    public Enrollment saveEnrollment(Enrollment enrollment) {
        validateReferences(enrollment);
        return enrollmentRepository.save(enrollment);
    }

    @Override
    public void deleteEnrollment(Long idEnrollment) {
        enrollmentRepository.deleteById(idEnrollment);
    }

    /**
     * Cross-service integrity check: an enrollment may only reference a student and a
     * course that actually exist. Both remote services answer {@code 404} for an unknown
     * id, which Feign surfaces as {@link FeignException.NotFound}; that is translated into
     * a domain exception so the API answers 404 as well.
     */
    private void validateReferences(Enrollment enrollment) {
        if (enrollment.getStudentId() != null) {
            try {
                studentClient.getStudent(enrollment.getStudentId());
            } catch (FeignException.NotFound ex) {
                throw new StudentNotFoundException(enrollment.getStudentId());
            }
        }
        if (enrollment.getCourseId() != null) {
            try {
                courseClient.getCourse(enrollment.getCourseId());
            } catch (FeignException.NotFound ex) {
                throw new CourseNotFoundException(enrollment.getCourseId());
            }
        }
    }
}

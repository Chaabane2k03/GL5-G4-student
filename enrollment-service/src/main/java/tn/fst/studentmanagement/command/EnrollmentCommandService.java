package tn.fst.studentmanagement.command;

import feign.FeignException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tn.fst.studentmanagement.clients.CourseClient;
import tn.fst.studentmanagement.clients.StudentClient;
import tn.fst.studentmanagement.entities.Enrollment;
import tn.fst.studentmanagement.exceptions.CourseNotFoundException;
import tn.fst.studentmanagement.exceptions.EnrollmentNotFoundException;
import tn.fst.studentmanagement.exceptions.StudentNotFoundException;
import tn.fst.studentmanagement.repositories.EnrollmentRepository;

/**
 * Write side of the enrollment service (CQRS). Every method changes state and none of them
 * returns domain data: create returns only the new id, update and delete return nothing.
 * Reads live in {@code EnrollmentQueryService}.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class EnrollmentCommandService {

    private final EnrollmentRepository enrollmentRepository;
    private final StudentClient studentClient;
    private final CourseClient courseClient;

    public Long create(CreateEnrollmentCommand command) {
        validateReferences(command.studentId(), command.courseId());

        Enrollment enrollment = new Enrollment();
        enrollment.setEnrollmentDate(command.enrollmentDate());
        enrollment.setGrade(command.grade());
        enrollment.setStatus(command.status());
        enrollment.setStudentId(command.studentId());
        enrollment.setCourseId(command.courseId());

        return enrollmentRepository.save(enrollment).getIdEnrollment();
    }

    public void update(UpdateEnrollmentCommand command) {
        Enrollment enrollment = enrollmentRepository.findById(command.idEnrollment())
                .orElseThrow(() -> new EnrollmentNotFoundException(command.idEnrollment()));
        validateReferences(command.studentId(), command.courseId());

        enrollment.setEnrollmentDate(command.enrollmentDate());
        enrollment.setGrade(command.grade());
        enrollment.setStatus(command.status());
        enrollment.setStudentId(command.studentId());
        enrollment.setCourseId(command.courseId());

        enrollmentRepository.save(enrollment);
    }

    public void delete(Long idEnrollment) {
        if (!enrollmentRepository.existsById(idEnrollment)) {
            throw new EnrollmentNotFoundException(idEnrollment);
        }
        enrollmentRepository.deleteById(idEnrollment);
    }

    /**
     * Cross-service integrity check: an enrollment may only reference a student and a course
     * that exist. A 404 from either service is translated into a domain exception.
     */
    private void validateReferences(Long studentId, Long courseId) {
        if (studentId != null) {
            try {
                studentClient.getStudent(studentId);
            } catch (FeignException.NotFound ex) {
                throw new StudentNotFoundException(studentId);
            }
        }
        if (courseId != null) {
            try {
                courseClient.getCourse(courseId);
            } catch (FeignException.NotFound ex) {
                throw new CourseNotFoundException(courseId);
            }
        }
    }
}
package tn.fst.studentmanagement.command;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import feign.FeignException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tn.fst.studentmanagement.clients.CourseClient;
import tn.fst.studentmanagement.clients.StudentClient;
import tn.fst.studentmanagement.entities.Enrollment;
import tn.fst.studentmanagement.exceptions.CourseNotFoundException;
import tn.fst.studentmanagement.exceptions.EnrollmentNotFoundException;
import tn.fst.studentmanagement.exceptions.StudentNotFoundException;
import tn.fst.studentmanagement.integration.EnrollmentCreatedIntegrationEvent;
import tn.fst.studentmanagement.integration.OutboxEvent;
import tn.fst.studentmanagement.integration.OutboxEventRepository;
import tn.fst.studentmanagement.integration.RabbitMQConfig;
import tn.fst.studentmanagement.repositories.EnrollmentRepository;

import java.time.Instant;
import java.util.UUID;

/**
 * Write side of the enrollment service (CQRS). Every method changes state and none of them
 * returns domain data: create returns only the new id, update and delete return nothing.
 * Reads live in {@code EnrollmentQueryService}.
 */
@Service
@Transactional
public class EnrollmentCommandService {

    private final EnrollmentRepository enrollmentRepository;
    private final StudentClient studentClient;
    private final CourseClient courseClient;
    private final OutboxEventRepository outboxRepository;
    private final ObjectMapper objectMapper;
    private final boolean eventsEnabled;

    public EnrollmentCommandService(EnrollmentRepository enrollmentRepository,
                                    StudentClient studentClient,
                                    CourseClient courseClient,
                                    OutboxEventRepository outboxRepository,
                                    ObjectMapper objectMapper,
                                    @Value("${enrollment.events.enabled:false}") boolean eventsEnabled) {
        this.enrollmentRepository = enrollmentRepository;
        this.studentClient = studentClient;
        this.courseClient = courseClient;
        this.outboxRepository = outboxRepository;
        this.objectMapper = objectMapper;
        this.eventsEnabled = eventsEnabled;
    }

    public Long create(CreateEnrollmentCommand command) {
        validateReferences(command.studentId(), command.courseId());

        Enrollment enrollment = new Enrollment();
        enrollment.setEnrollmentDate(command.enrollmentDate());
        enrollment.setGrade(command.grade());
        enrollment.setStatus(command.status());
        enrollment.setStudentId(command.studentId());
        enrollment.setCourseId(command.courseId());

        Long id = enrollmentRepository.save(enrollment).getIdEnrollment();

        // The only async demo flow. The outbox row is written in this SAME transaction as the
        // enrollment row, so we cannot commit the enrollment and lose the event. It is disabled
        // by default; only docker-compose turns it on.
        if (eventsEnabled) {
            writeOutbox(id, command);
        }
        return id;
    }

    private void writeOutbox(Long id, CreateEnrollmentCommand command) {
        Instant now = Instant.now();
        String eventId = UUID.randomUUID().toString();
        EnrollmentCreatedIntegrationEvent event = new EnrollmentCreatedIntegrationEvent(
                eventId,
                String.valueOf(id),
                command.enrollmentDate() == null ? null : command.enrollmentDate().toString(),
                command.grade(),
                command.status() == null ? null : command.status().name(),
                command.studentId(),
                command.courseId(),
                now.toString());
        try {
            outboxRepository.save(new OutboxEvent(eventId, RabbitMQConfig.ROUTING_KEY,
                    objectMapper.writeValueAsString(event), now));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Cannot serialize enrollment.created event", e);
        }
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

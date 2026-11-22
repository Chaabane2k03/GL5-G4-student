package tn.fst.studentmanagement.entities;

import jakarta.persistence.*;
import java.time.LocalDate;

@Entity
public class Enrollment {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long idEnrollment;
    private LocalDate enrollmentDate;
    private Double grade;
    @Enumerated(EnumType.STRING)
    private Status status;

    private Long studentId;

    private Long courseId;

    public Enrollment() {
    }

    public Enrollment(Long idEnrollment, LocalDate enrollmentDate, Double grade, Status status,
                      Long studentId, Long courseId) {
        this.idEnrollment = idEnrollment;
        this.enrollmentDate = enrollmentDate;
        this.grade = grade;
        this.status = status;
        this.studentId = studentId;
        this.courseId = courseId;
    }

    public Long getIdEnrollment() {
        return idEnrollment;
    }

    public void setIdEnrollment(Long idEnrollment) {
        this.idEnrollment = idEnrollment;
    }

    public LocalDate getEnrollmentDate() {
        return enrollmentDate;
    }

    public void setEnrollmentDate(LocalDate enrollmentDate) {
        this.enrollmentDate = enrollmentDate;
    }

    public Double getGrade() {
        return grade;
    }

    public void setGrade(Double grade) {
        this.grade = grade;
    }

    public Status getStatus() {
        return status;
    }

    public void setStatus(Status status) {
        this.status = status;
    }

    public Long getStudentId() {
        return studentId;
    }

    public void setStudentId(Long studentId) {
        this.studentId = studentId;
    }

    public Long getCourseId() {
        return courseId;
    }

    public void setCourseId(Long courseId) {
        this.courseId = courseId;
    }
}
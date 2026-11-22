package tn.fst.studentmanagement.axon.projection;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import tn.fst.studentmanagement.entities.Status;

import java.time.LocalDate;

@Entity
@Table(name = "axon_enrollment_view")
public class AxonEnrollmentView {

    @Id
    private String enrollmentId;
    private LocalDate enrollmentDate;
    private Double grade;
    private Status status;
    private Long studentId;
    private Long courseId;

    public AxonEnrollmentView() {
    }

    public AxonEnrollmentView(String enrollmentId, LocalDate enrollmentDate, Double grade,
                               Status status, Long studentId, Long courseId) {
        this.enrollmentId = enrollmentId;
        this.enrollmentDate = enrollmentDate;
        this.grade = grade;
        this.status = status;
        this.studentId = studentId;
        this.courseId = courseId;
    }

    public String getEnrollmentId() {
        return enrollmentId;
    }

    public LocalDate getEnrollmentDate() {
        return enrollmentDate;
    }

    public Double getGrade() {
        return grade;
    }

    public Status getStatus() {
        return status;
    }

    public Long getStudentId() {
        return studentId;
    }

    public Long getCourseId() {
        return courseId;
    }

    public void setEnrollmentDate(LocalDate enrollmentDate) {
        this.enrollmentDate = enrollmentDate;
    }

    public void setGrade(Double grade) {
        this.grade = grade;
    }

    public void setStatus(Status status) {
        this.status = status;
    }

    public void setStudentId(Long studentId) {
        this.studentId = studentId;
    }

    public void setCourseId(Long courseId) {
        this.courseId = courseId;
    }
}

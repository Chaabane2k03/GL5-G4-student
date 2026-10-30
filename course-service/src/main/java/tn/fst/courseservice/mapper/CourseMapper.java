package tn.fst.courseservice.mapper;

import tn.fst.courseservice.dto.CourseRequest;
import tn.fst.courseservice.dto.CourseResponse;
import tn.fst.courseservice.entity.Course;
import org.springframework.stereotype.Component;

/**
 * Manual mapper between {@link CourseRequest}, {@link Course} and {@link CourseResponse}.
 * No MapStruct, no reflection.
 */
@Component
public class CourseMapper {

    public Course toEntity(CourseRequest request) {
        Course course = new Course();
        course.setCode(request.code());
        course.setTitle(request.title());
        course.setDescription(request.description());
        course.setCredits(request.credits());
        course.setDepartmentId(request.departmentId());
        return course;
    }

    /**
     * Copies the mutable business fields onto an existing entity. Status is intentionally
     * left untouched: status transitions are owned by the service.
     */
    public void updateEntity(Course course, CourseRequest request) {
        course.setCode(request.code());
        course.setTitle(request.title());
        course.setDescription(request.description());
        course.setCredits(request.credits());
        course.setDepartmentId(request.departmentId());
    }

    public CourseResponse toResponse(Course course) {
        return new CourseResponse(
                course.getId(),
                course.getCode(),
                course.getTitle(),
                course.getDescription(),
                course.getCredits(),
                course.getDepartmentId(),
                course.getStatus(),
                course.getCreatedAt(),
                course.getUpdatedAt());
    }
}

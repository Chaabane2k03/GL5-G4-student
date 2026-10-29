package tn.fst.course.service;

import tn.fst.course.dto.CourseRequest;
import tn.fst.course.dto.CourseResponse;
import tn.fst.course.dto.PageResponse;
import tn.fst.course.entity.CourseStatus;

/**
 * Business operations for courses.
 */
public interface CourseService {

    CourseResponse create(CourseRequest request);

    CourseResponse getById(Long id);

    PageResponse<CourseResponse> list(Long departmentId, CourseStatus status, int page, int size, String sort);

    CourseResponse update(Long id, CourseRequest request);

    void archive(Long id);

    CourseResponse activate(Long id);
}

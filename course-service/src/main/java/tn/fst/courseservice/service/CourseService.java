package tn.fst.courseservice.service;

import tn.fst.courseservice.dto.CourseRequest;
import tn.fst.courseservice.dto.CourseResponse;
import tn.fst.courseservice.dto.PageResponse;
import tn.fst.courseservice.entity.CourseStatus;

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

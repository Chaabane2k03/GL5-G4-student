package com.eduplatform.course.service;

import com.eduplatform.course.dto.CourseRequest;
import com.eduplatform.course.dto.CourseResponse;
import com.eduplatform.course.dto.PageResponse;
import com.eduplatform.course.entity.CourseStatus;

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

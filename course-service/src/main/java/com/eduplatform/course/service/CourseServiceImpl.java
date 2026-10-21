package com.eduplatform.course.service;

import com.eduplatform.course.client.DepartmentClient;
import com.eduplatform.course.dto.CourseRequest;
import com.eduplatform.course.dto.CourseResponse;
import com.eduplatform.course.dto.PageResponse;
import com.eduplatform.course.entity.Course;
import com.eduplatform.course.entity.CourseStatus;
import com.eduplatform.course.exception.CourseNotFoundException;
import com.eduplatform.course.exception.DepartmentNotFoundException;
import com.eduplatform.course.exception.DepartmentServiceUnavailableException;
import com.eduplatform.course.exception.DuplicateCourseCodeException;
import com.eduplatform.course.exception.InvalidRequestException;
import com.eduplatform.course.mapper.CourseMapper;
import com.eduplatform.course.repository.CourseRepository;
import feign.FeignException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.SQLIntegrityConstraintViolationException;
import java.util.Locale;
import java.util.Set;

/**
 * Default {@link CourseService} implementation.
 */
@Service
public class CourseServiceImpl implements CourseService {

    static final Set<String> ALLOWED_SORT_FIELDS = Set.of("id", "code", "title", "credits", "createdAt");
    static final int MAX_PAGE_SIZE = 100;
    private static final Logger LOG = LoggerFactory.getLogger(CourseServiceImpl.class);
    private static final int MYSQL_DUPLICATE_KEY_ERROR_CODE = 1062;
    private static final Sort DEFAULT_SORT = Sort.by(Sort.Direction.ASC, "code");

    private final CourseRepository courseRepository;
    private final CourseMapper courseMapper;
    private final DepartmentClient departmentClient;
    private final String departmentValidation;

    public CourseServiceImpl(CourseRepository courseRepository, CourseMapper courseMapper,
                             DepartmentClient departmentClient,
                             @Value("${app.department.validation:strict}") String departmentValidation) {
        this.courseRepository = courseRepository;
        this.courseMapper = courseMapper;
        this.departmentClient = departmentClient;
        this.departmentValidation = departmentValidation;
    }

    @Override
    @Transactional
    public CourseResponse create(CourseRequest request) {
        String code = normalizeCode(request.code());
        if (courseRepository.existsByCode(code)) {
            throw new DuplicateCourseCodeException(code);
        }
        requireDepartmentExists(request.departmentId());
        Course course = courseMapper.toEntity(request);
        course.setCode(code);
        course.setStatus(CourseStatus.ACTIVE);
        return courseMapper.toResponse(save(course));
    }

    @Override
    @Transactional(readOnly = true)
    public CourseResponse getById(Long id) {
        return courseMapper.toResponse(findById(id));
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<CourseResponse> list(Long departmentId, CourseStatus status, int page, int size, String sort) {
        if (page < 0) {
            throw new InvalidRequestException("page must be greater than or equal to 0");
        }
        if (size < 1 || size > MAX_PAGE_SIZE) {
            throw new InvalidRequestException("size must be between 1 and " + MAX_PAGE_SIZE);
        }
        Sort sortOrder = parseSort(sort);
        Specification<Course> specification =
                Specification.allOf(hasDepartmentId(departmentId), hasStatus(status));
        Page<Course> result = courseRepository.findAll(specification, PageRequest.of(page, size, sortOrder));
        return PageResponse.from(result.map(courseMapper::toResponse));
    }

    @Override
    @Transactional
    public CourseResponse update(Long id, CourseRequest request) {
        Course course = findById(id);
        String code = normalizeCode(request.code());
        if (courseRepository.existsByCodeAndIdNot(code, id)) {
            throw new DuplicateCourseCodeException(code);
        }
        requireDepartmentExists(request.departmentId());
        courseMapper.updateEntity(course, request);
        course.setCode(code);
        return courseMapper.toResponse(save(course));
    }

    @Override
    @Transactional
    public void archive(Long id) {
        Course course = findById(id);
        course.setStatus(CourseStatus.ARCHIVED);
        courseRepository.saveAndFlush(course);
    }

    @Override
    @Transactional
    public CourseResponse activate(Long id) {
        Course course = findById(id);
        course.setStatus(CourseStatus.ACTIVE);
        return courseMapper.toResponse(courseRepository.saveAndFlush(course));
    }

    private Course save(Course course) {
        try {
            // Flush eagerly so that @UpdateTimestamp is applied before mapping, and so an
            // integrity violation (unique key race) surfaces here where it can be translated.
            return courseRepository.saveAndFlush(course);
        } catch (DataIntegrityViolationException ex) {
            // Race condition: another transaction inserted the same code between the
            // existence check and this save. Only the unique-key conflict becomes a 409
            // response, while any other integrity failure, such as a CHECK violation,
            // must stay a 500.
            if (isDuplicateCode(ex)) {
                throw new DuplicateCourseCodeException(course.getCode());
            }
            throw ex;
        }
    }

    private Course findById(Long id) {
        return courseRepository.findById(id).orElseThrow(() -> new CourseNotFoundException(id));
    }

    /**
     * Cross-service integrity check: a course must belong to an existing department. The
     * department-service answers 404 for an unknown id, which Feign surfaces as
     * {@link FeignException.NotFound} and is translated into a domain exception (404).
     *
     * <p>Selected by {@code app.department.validation}:</p>
     * <ul>
     *   <li>{@code strict} (default) - the check always runs. When the department-service
     *       cannot be reached the write is refused with
     *       {@link DepartmentServiceUnavailableException} (503) rather than persisting an
     *       unverified department id. Any value other than {@code off} behaves like
     *       {@code strict}, so a mistyped value fails safe.</li>
     *   <li>{@code off} - set by the standalone compose, where course-service runs alone
     *       and there is no department-service to ask. The client is not called at all and
     *       departments are referenced by id only.</li>
     * </ul>
     */
    private void requireDepartmentExists(Long departmentId) {
        if ("off".equalsIgnoreCase(departmentValidation)) {
            return;
        }
        try {
            departmentClient.getDepartment(departmentId);
        } catch (FeignException.NotFound ex) {
            throw new DepartmentNotFoundException(departmentId);
        } catch (FeignException ex) {
            LOG.warn("department-service unavailable, refusing write for department {}: {}",
                    departmentId, ex.getMessage());
            throw new DepartmentServiceUnavailableException(departmentId);
        }
    }

    static String normalizeCode(String code) {
        return code == null ? null : code.trim().toUpperCase(Locale.ROOT);
    }

    static Sort parseSort(String sort) {
        if (sort == null || sort.isBlank()) {
            return DEFAULT_SORT;
        }
        String[] parts = sort.split(",");
        if (parts.length > 2) {
            throw new InvalidRequestException("sort must be 'field' or 'field,direction'");
        }
        String field = parts[0].trim();
        if (!ALLOWED_SORT_FIELDS.contains(field)) {
            throw new InvalidRequestException("sort field '" + field + "' is not allowed");
        }
        Sort.Direction direction = Sort.Direction.ASC;
        if (parts.length == 2) {
            String rawDirection = parts[1].trim();
            if (!rawDirection.equalsIgnoreCase("asc") && !rawDirection.equalsIgnoreCase("desc")) {
                throw new InvalidRequestException("sort direction must be 'asc' or 'desc'");
            }
            direction = rawDirection.equalsIgnoreCase("desc") ? Sort.Direction.DESC : Sort.Direction.ASC;
        }
        return Sort.by(direction, field);
    }

    static Specification<Course> hasDepartmentId(Long departmentId) {
        return (root, query, cb) ->
                departmentId == null ? cb.conjunction() : cb.equal(root.get("departmentId"), departmentId);
    }

    static Specification<Course> hasStatus(CourseStatus status) {
        return (root, query, cb) ->
                status == null ? cb.conjunction() : cb.equal(root.get("status"), status);
    }

    private static boolean isDuplicateCode(DataIntegrityViolationException ex) {
        Throwable cause = ex;
        while (cause != null) {
            if (cause instanceof SQLIntegrityConstraintViolationException sqlEx) {
                return sqlEx.getErrorCode() == MYSQL_DUPLICATE_KEY_ERROR_CODE;
            }
            String message = cause.getMessage();
            if (message != null) {
                String lower = message.toLowerCase(Locale.ROOT);
                if (lower.contains("uk_course_code") || lower.contains("duplicate entry")) {
                    return true;
                }
            }
            cause = cause.getCause();
        }
        return false;
    }
}

package com.eduplatform.course.controller;

import com.eduplatform.course.dto.CourseRequest;
import com.eduplatform.course.dto.CourseResponse;
import com.eduplatform.course.dto.ErrorResponse;
import com.eduplatform.course.dto.PageResponse;
import com.eduplatform.course.entity.CourseStatus;
import com.eduplatform.course.service.CourseService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * REST API for courses. Exposes DTOs only, never entities.
 */
@Tag(name = "Courses", description = "Manage courses: create, read, update, archive and activate.")
@RestController
@RequestMapping("/api/courses")
public class CourseController {

    private final CourseService courseService;

    public CourseController(CourseService courseService) {
        this.courseService = courseService;
    }

    @Operation(summary = "Create a course",
            description = "Creates a course in ACTIVE status. The code is trimmed and uppercased.")
    @ApiResponse(responseCode = "201", description = "Course created")
    @ApiResponse(responseCode = "400", description = "Validation failed",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @ApiResponse(responseCode = "409", description = "Duplicate course code",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CourseResponse create(@Valid @RequestBody CourseRequest request) {
        return courseService.create(request);
    }

    @Operation(summary = "Get a course by id")
    @ApiResponse(responseCode = "200", description = "Course found")
    @ApiResponse(responseCode = "404", description = "Course not found",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @GetMapping("/{id}")
    public CourseResponse getById(
            @Parameter(description = "Course id", example = "1", required = true) @PathVariable Long id) {
        return courseService.getById(id);
    }

    @Operation(summary = "List courses",
            description = "Returns a paginated page of courses, optionally filtered by department and status.")
    @ApiResponse(responseCode = "200", description = "Page of courses")
    @ApiResponse(responseCode = "400", description = "Invalid paging or sort parameters",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @GetMapping
    public PageResponse<CourseResponse> list(
            @Parameter(description = "Only return courses of this department") @RequestParam(required = false) Long departmentId,
            @Parameter(description = "Only return courses with this status") @RequestParam(required = false) CourseStatus status,
            @Parameter(description = "Zero-based page index", example = "0") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Page size (1-100)", example = "20") @RequestParam(defaultValue = "20") int size,
            @Parameter(description = "Sort as 'field' or 'field,direction' (asc|desc)",
                    example = "code,asc") @RequestParam(defaultValue = "code,asc") String sort) {
        return courseService.list(departmentId, status, page, size, sort);
    }

    @Operation(summary = "Update a course",
            description = "Replaces the mutable fields of a course. The status is not changed. The code is trimmed and uppercased.")
    @ApiResponse(responseCode = "200", description = "Course updated")
    @ApiResponse(responseCode = "400", description = "Validation failed",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @ApiResponse(responseCode = "404", description = "Course not found",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @ApiResponse(responseCode = "409", description = "Duplicate course code",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @PutMapping("/{id}")
    public CourseResponse update(
            @Parameter(description = "Course id", example = "1", required = true) @PathVariable Long id,
            @Valid @RequestBody CourseRequest request) {
        return courseService.update(id, request);
    }

    @Operation(summary = "Archive a course", description = "Sets the course status to ARCHIVED. Idempotent.")
    @ApiResponse(responseCode = "204", description = "Course archived")
    @ApiResponse(responseCode = "404", description = "Course not found",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void archive(
            @Parameter(description = "Course id", example = "1", required = true) @PathVariable Long id) {
        courseService.archive(id);
    }

    @Operation(summary = "Activate a course", description = "Sets the course status to ACTIVE. Idempotent.")
    @ApiResponse(responseCode = "200", description = "Course activated")
    @ApiResponse(responseCode = "404", description = "Course not found",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    @PatchMapping("/{id}/activate")
    public CourseResponse activate(
            @Parameter(description = "Course id", example = "1", required = true) @PathVariable Long id) {
        return courseService.activate(id);
    }
}

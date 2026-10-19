package com.eduplatform.course.controller;

import com.eduplatform.course.dto.CourseRequest;
import com.eduplatform.course.dto.CourseResponse;
import com.eduplatform.course.dto.PageResponse;
import com.eduplatform.course.entity.CourseStatus;
import com.eduplatform.course.exception.CourseNotFoundException;
import com.eduplatform.course.exception.DepartmentNotFoundException;
import com.eduplatform.course.exception.DepartmentServiceUnavailableException;
import com.eduplatform.course.exception.DuplicateCourseCodeException;
import com.eduplatform.course.exception.InvalidRequestException;
import com.eduplatform.course.service.CourseService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(CourseController.class)
class CourseControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private CourseService courseService;

    private static CourseResponse sampleResponse() {
        return new CourseResponse(1L, "CS101", "Intro", "desc", 6, 2L, CourseStatus.ACTIVE,
                LocalDateTime.of(2024, 1, 1, 10, 0), LocalDateTime.of(2024, 1, 2, 10, 0));
    }

    private static CourseRequest validRequest() {
        return new CourseRequest("CS101", "Intro", "desc", 6, 2L);
    }

    private String json(Object value) throws Exception {
        return objectMapper.writeValueAsString(value);
    }

    @Test
    void createShouldReturn201WithBody() throws Exception {
        when(courseService.create(any(CourseRequest.class))).thenReturn(sampleResponse());

        mockMvc.perform(post("/api/courses")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(validRequest())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.code").value("CS101"))
                .andExpect(jsonPath("$.status").value("ACTIVE"));
    }

    @Test
    void createShouldReturn400WithFieldErrorsWhenInvalid() throws Exception {
        CourseRequest invalid = new CourseRequest("", "", "desc", 0, null);

        mockMvc.perform(post("/api/courses")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(invalid)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.message").value("Validation failed"))
                .andExpect(jsonPath("$.path").value("/api/courses"))
                .andExpect(jsonPath("$.fieldErrors").isArray())
                .andExpect(jsonPath("$.fieldErrors[?(@.field == 'code')]").exists())
                .andExpect(jsonPath("$.fieldErrors[?(@.field == 'credits')]").exists())
                .andExpect(jsonPath("$.fieldErrors[?(@.field == 'departmentId')]").exists());
    }

    @Test
    void createShouldReturn400WhenBodyIsMalformed() throws Exception {
        mockMvc.perform(post("/api/courses")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{ not-json "))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Malformed or unreadable request body"))
                .andExpect(jsonPath("$.fieldErrors").isEmpty());
    }

    @Test
    void createShouldReturn409WhenDuplicate() throws Exception {
        when(courseService.create(any(CourseRequest.class))).thenThrow(new DuplicateCourseCodeException("CS101"));

        mockMvc.perform(post("/api/courses")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(validRequest())))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("CS101")));
    }

    @Test
    void createShouldReturn404WhenDepartmentMissing() throws Exception {
        when(courseService.create(any(CourseRequest.class))).thenThrow(new DepartmentNotFoundException(2L));

        mockMvc.perform(post("/api/courses")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(validRequest())))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("2")));
    }

    @Test
    void createShouldReturn503WhenDepartmentServiceUnavailable() throws Exception {
        when(courseService.create(any(CourseRequest.class)))
                .thenThrow(new DepartmentServiceUnavailableException(2L));

        mockMvc.perform(post("/api/courses")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(validRequest())))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.status").value(503))
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("2")));
    }

    @Test
    void getByIdShouldReturn200() throws Exception {
        when(courseService.getById(1L)).thenReturn(sampleResponse());

        mockMvc.perform(get("/api/courses/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.credits").value(6));
    }

    @Test
    void getByIdShouldReturn404WhenMissing() throws Exception {
        when(courseService.getById(99L)).thenThrow(new CourseNotFoundException(99L));

        mockMvc.perform(get("/api/courses/99"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("99")));
    }

    @Test
    void listShouldReturnPageEnvelopeAndPassDefaults() throws Exception {
        PageResponse<CourseResponse> pageResponse =
                new PageResponse<>(List.of(sampleResponse()), 0, 20, 1, 1, true, true);
        when(courseService.list(isNull(), isNull(), eq(0), eq(20), eq("code,asc"))).thenReturn(pageResponse);

        mockMvc.perform(get("/api/courses"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray())
                .andExpect(jsonPath("$.content[0].code").value("CS101"))
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(20))
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.totalPages").value(1))
                .andExpect(jsonPath("$.first").value(true))
                .andExpect(jsonPath("$.last").value(true));
    }

    @Test
    void listShouldForwardFiltersAndPagination() throws Exception {
        when(courseService.list(7L, CourseStatus.ACTIVE, 2, 5, "credits,desc"))
                .thenReturn(new PageResponse<>(List.of(), 2, 5, 0, 0, false, true));

        mockMvc.perform(get("/api/courses")
                        .param("departmentId", "7")
                        .param("status", "ACTIVE")
                        .param("page", "2")
                        .param("size", "5")
                        .param("sort", "credits,desc"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page").value(2));
    }

    @Test
    void listShouldReturn400OnInvalidStatusEnum() throws Exception {
        mockMvc.perform(get("/api/courses").param("status", "NOT_A_STATUS"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("status")));
    }

    @Test
    void listShouldReturn400WhenServiceRejectsParameters() throws Exception {
        when(courseService.list(isNull(), isNull(), anyInt(), anyInt(), anyString()))
                .thenThrow(new InvalidRequestException("page must be greater than or equal to 0"));

        mockMvc.perform(get("/api/courses").param("page", "-1"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));
    }

    @Test
    void updateShouldReturn200() throws Exception {
        when(courseService.update(eq(1L), any(CourseRequest.class))).thenReturn(sampleResponse());

        mockMvc.perform(put("/api/courses/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(validRequest())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1));
    }

    @Test
    void updateShouldReturn400WhenBodyInvalid() throws Exception {
        CourseRequest invalid = new CourseRequest("CS101", "Intro", "desc", 99, 2L);

        mockMvc.perform(put("/api/courses/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(invalid)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors[?(@.field == 'credits')]").exists());
    }

    @Test
    void updateShouldReturn409WhenDuplicate() throws Exception {
        when(courseService.update(eq(1L), any(CourseRequest.class)))
                .thenThrow(new DuplicateCourseCodeException("CS101"));

        mockMvc.perform(put("/api/courses/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(validRequest())))
                .andExpect(status().isConflict());
    }

    @Test
    void archiveShouldReturn204() throws Exception {
        doNothing().when(courseService).archive(1L);

        mockMvc.perform(delete("/api/courses/1"))
                .andExpect(status().isNoContent())
                .andExpect(content().string(""));
    }

    @Test
    void archiveShouldReturn404WhenMissing() throws Exception {
        doThrow(new CourseNotFoundException(1L)).when(courseService).archive(1L);

        mockMvc.perform(delete("/api/courses/1"))
                .andExpect(status().isNotFound());
    }

    @Test
    void activateShouldReturn200() throws Exception {
        when(courseService.activate(1L)).thenReturn(sampleResponse());

        mockMvc.perform(patch("/api/courses/1/activate"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACTIVE"));
    }

    @Test
    void unexpectedErrorShouldReturn500WithoutLeakingDetails() throws Exception {
        when(courseService.getById(1L)).thenThrow(new RuntimeException("boom secret detail"));

        mockMvc.perform(get("/api/courses/1"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.status").value(500))
                .andExpect(jsonPath("$.message").value("An unexpected error occurred"))
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.not(
                        org.hamcrest.Matchers.containsString("secret"))));
    }

    @Test
    void getByIdShouldReturn400OnNonNumericId() throws Exception {
        mockMvc.perform(get("/api/courses/abc"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));
    }

    @Test
    void listShouldReturnJsonContentType() throws Exception {
        when(courseService.list(isNull(), isNull(), eq(0), eq(20), eq("code,asc")))
                .thenReturn(new PageResponse<>(List.of(), 0, 20, 0, 0, true, true));

        mockMvc.perform(get("/api/courses"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", org.hamcrest.Matchers.containsString("application/json")));
    }
}

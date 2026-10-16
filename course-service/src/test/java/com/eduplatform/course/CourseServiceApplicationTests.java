package com.eduplatform.course;

import com.eduplatform.course.client.DepartmentClient;
import com.eduplatform.course.dto.CourseRequest;
import com.eduplatform.course.dto.CourseResponse;
import com.eduplatform.course.entity.CourseStatus;
import com.eduplatform.course.repository.CourseRepository;
import com.eduplatform.course.support.TestcontainersConfiguration;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Boots the whole application (real HTTP server, real MySQL Testcontainer via schema.sql)
 * and drives the public API end to end.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
class CourseServiceApplicationTests {

    private static final String BASE = "/api/courses";

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private CourseRepository courseRepository;

    /**
     * The department-service is not part of this test context, so the Feign client is
     * replaced with a mock. Returning {@code null} means "department exists" to the
     * course service, keeping the E2E flow focused on course persistence.
     */
    @MockitoBean
    private DepartmentClient departmentClient;

    /**
     * These tests commit real rows over HTTP (no test transaction), so clean the shared
     * container afterwards to keep the DB-backed test classes order-independent.
     */
    @AfterEach
    void cleanDatabase() {
        courseRepository.deleteAll();
    }

    @Test
    void contextLoads() {
        assertThat(restTemplate).isNotNull();
    }

    @Test
    void fullCrudLifecycle() {
        CourseRequest createRequest = new CourseRequest("E2E101", "E2E Course", "desc", 3, 1L);

        ResponseEntity<CourseResponse> created =
                restTemplate.postForEntity(BASE, createRequest, CourseResponse.class);
        assertThat(created.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        CourseResponse createdBody = created.getBody();
        assertThat(createdBody).isNotNull();
        assertThat(createdBody.code()).isEqualTo("E2E101");
        assertThat(createdBody.status()).isEqualTo(CourseStatus.ACTIVE);
        assertThat(createdBody.createdAt()).isNotNull();
        Long id = createdBody.id();

        ResponseEntity<CourseResponse> fetched =
                restTemplate.getForEntity(BASE + "/" + id, CourseResponse.class);
        assertThat(fetched.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(fetched.getBody()).isNotNull();
        assertThat(fetched.getBody().code()).isEqualTo("E2E101");

        CourseRequest updateRequest = new CourseRequest("E2E101", "Updated title", "desc2", 5, 2L);
        restTemplate.put(BASE + "/" + id, updateRequest);

        ResponseEntity<CourseResponse> updated =
                restTemplate.getForEntity(BASE + "/" + id, CourseResponse.class);
        assertThat(updated.getBody()).isNotNull();
        assertThat(updated.getBody().title()).isEqualTo("Updated title");
        assertThat(updated.getBody().credits()).isEqualTo(5);
        assertThat(updated.getBody().departmentId()).isEqualTo(2L);

        ResponseEntity<String> list = restTemplate.getForEntity(BASE + "?size=100", String.class);
        assertThat(list.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(list.getBody()).contains("E2E101").contains("totalElements");

        restTemplate.delete(BASE + "/" + id);
        ResponseEntity<CourseResponse> archived =
                restTemplate.getForEntity(BASE + "/" + id, CourseResponse.class);
        assertThat(archived.getBody()).isNotNull();
        assertThat(archived.getBody().status()).isEqualTo(CourseStatus.ARCHIVED);

        ResponseEntity<CourseResponse> activated = restTemplate.exchange(
                BASE + "/" + id + "/activate", HttpMethod.PATCH, null, CourseResponse.class);
        assertThat(activated.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(activated.getBody()).isNotNull();
        assertThat(activated.getBody().status()).isEqualTo(CourseStatus.ACTIVE);
    }

    @Test
    void duplicateCodeReturns409() {
        CourseRequest request = new CourseRequest("E2E409", "Dup", "d", 3, 1L);

        ResponseEntity<String> first = restTemplate.postForEntity(BASE, request, String.class);
        assertThat(first.getStatusCode()).isEqualTo(HttpStatus.CREATED);

        ResponseEntity<String> second = restTemplate.postForEntity(BASE, request, String.class);
        assertThat(second.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(second.getBody()).contains("E2E409");
    }

    @Test
    void lowerCaseCodeIsNormalizedOnCreate() {
        CourseRequest request = new CourseRequest("  e2e-lower ", "Lower", "d", 3, 1L);

        ResponseEntity<CourseResponse> created =
                restTemplate.postForEntity(BASE, request, CourseResponse.class);

        assertThat(created.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(created.getBody()).isNotNull();
        assertThat(created.getBody().code()).isEqualTo("E2E-LOWER");
    }

    @Test
    void missingCourseReturns404WithErrorBody() {
        ResponseEntity<String> response =
                restTemplate.getForEntity(BASE + "/999999999", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).contains("\"status\":404").contains("fieldErrors");
    }

    @Test
    void invalidPayloadReturns400WithFieldErrors() {
        CourseRequest invalid = new CourseRequest("", "", "d", 0, null);

        ResponseEntity<String> response = restTemplate.postForEntity(BASE, invalid, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).contains("Validation failed").contains("fieldErrors");
    }

    @Test
    void unknownSortFieldIsRejected() {
        ResponseEntity<String> response = restTemplate.getForEntity(BASE + "?sort=nope,asc", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void openApiSpecIsServedWithDocumentedOperations() {
        ResponseEntity<String> response = restTemplate.getForEntity("/v3/api-docs", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody())
                .contains("Course Service API")
                .contains("/api/courses")
                .contains("Create a course");
    }
}

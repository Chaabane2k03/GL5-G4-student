package tn.fst.departmentservice;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;
import tn.fst.departmentservice.entity.Department;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class DepartmentServiceIntegrationTest {

    @Autowired
    private TestRestTemplate restTemplate;

    @Test
    void createsReadsUpdatesAndDeletesDepartment() {
        Department department = new Department(null, "Computer Science", "Building A", "123", "A. Smith");

        ResponseEntity<Department> created = restTemplate.postForEntity("/api/departments", department, Department.class);
        assertEquals(HttpStatus.CREATED, created.getStatusCode());
        assertNotNull(created.getBody());
        Long id = created.getBody().getIdDepartment();

        ResponseEntity<Department> fetched = restTemplate.getForEntity("/api/departments/{id}", Department.class, id);
        assertEquals(HttpStatus.OK, fetched.getStatusCode());
        assertEquals("Computer Science", fetched.getBody().getName());

        Department update = new Department(null, "Computer Science and Engineering", "Building A", "321", "A. Smith");
        restTemplate.put("/api/departments/{id}", update, id);
        ResponseEntity<Department> updated = restTemplate.getForEntity("/api/departments/{id}", Department.class, id);
        assertEquals("Computer Science and Engineering", updated.getBody().getName());

        restTemplate.delete("/api/departments/{id}", id);
        ResponseEntity<String> missing = restTemplate.getForEntity("/api/departments/{id}", String.class, id);
        assertEquals(HttpStatus.NOT_FOUND, missing.getStatusCode());
    }

    @Test
    void publishesOpenApiDocumentation() {
        ResponseEntity<String> openApi = restTemplate.getForEntity("/v3/api-docs", String.class);

        assertEquals(HttpStatus.OK, openApi.getStatusCode());
        assertNotNull(openApi.getBody());
        assertTrue(openApi.getBody().contains("\"title\":\"Department Service API\""));
    }
}

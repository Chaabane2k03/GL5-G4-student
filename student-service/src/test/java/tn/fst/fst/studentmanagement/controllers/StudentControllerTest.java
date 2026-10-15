package tn.fst.studentmanagement.controllers;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import tn.fst.studentmanagement.entities.Student;
import tn.fst.studentmanagement.services.IStudentService;

import java.time.LocalDate;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(StudentController.class)
class StudentControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private IStudentService studentService;

    private Student sampleStudent() {
        return new Student(1L, "John", "Doe", "john.doe@example.com",
                "12345678", LocalDate.of(2000, 1, 15), "Tunis", 10L);
    }

    @Test
    void getAllStudents_returnsList() throws Exception {
        when(studentService.getAllStudents()).thenReturn(List.of(sampleStudent()));

        mockMvc.perform(get("/students/getAllStudents"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].firstName").value("John"))
                .andExpect(jsonPath("$[0].email").value("john.doe@example.com"));

        verify(studentService).getAllStudents();
    }

    @Test
    void getStudent_existingId_returnsStudent() throws Exception {
        when(studentService.getStudentById(1L)).thenReturn(sampleStudent());

        mockMvc.perform(get("/students/getStudent/{id}", 1L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lastName").value("Doe"))
                .andExpect(jsonPath("$.departmentId").value(10L));

        verify(studentService).getStudentById(1L);
    }

    @Test
    void createStudent_returnsSavedStudent() throws Exception {
        Student saved = sampleStudent();
        when(studentService.saveStudent(any(Student.class))).thenReturn(saved);

        mockMvc.perform(post("/students/createStudent")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(sampleStudent())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.firstName").value("John"));

        verify(studentService).saveStudent(any(Student.class));
    }

    @Test
    void updateStudent_returnsUpdatedStudent() throws Exception {
        Student saved = sampleStudent();
        when(studentService.saveStudent(any(Student.class))).thenReturn(saved);

        mockMvc.perform(put("/students/updateStudent")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(sampleStudent())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("john.doe@example.com"));

        verify(studentService).saveStudent(any(Student.class));
    }

    @Test
    void deleteStudent_delegatesToService() throws Exception {
        mockMvc.perform(delete("/students/deleteStudent/{id}", 1L))
                .andExpect(status().isOk());

        verify(studentService).deleteStudent(1L);
    }
}

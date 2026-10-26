package tn.fst.studentmanagement.controllers;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AllArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import tn.fst.studentmanagement.entities.Student;
import tn.fst.studentmanagement.services.IStudentService;

import java.util.List;

@RestController
@RequestMapping("/students")
@AllArgsConstructor
@Tag(name = "Students", description = "Student management endpoints")
public class StudentController {
IStudentService studentService;

    @Operation(summary = "Get all students", description = "Returns the list of all students")
    @ApiResponse(responseCode = "200", description = "List of students retrieved successfully")
    @GetMapping("/getAllStudents")
    public List<Student> getAllStudents() { return studentService.getAllStudents(); }

    @Operation(summary = "Get a student by id", description = "Returns a single student; 404 when it does not exist")
    @ApiResponse(responseCode = "200", description = "Student retrieved successfully")
    @ApiResponse(responseCode = "404", description = "Student not found")
    @GetMapping("/getStudent/{id}")
    public Student getStudent(@Parameter(description = "Id of the student to retrieve") @PathVariable Long id) { return studentService.getStudentById(id); }

    @Operation(summary = "Create a student", description = "Persists a new student")
    @ApiResponse(responseCode = "200", description = "Student created successfully")
    @PostMapping("/createStudent")
    public Student createStudent(@RequestBody Student student) { return studentService.saveStudent(student); }

    @Operation(summary = "Update a student", description = "Persists changes to an existing student")
    @ApiResponse(responseCode = "200", description = "Student updated successfully")
    @PutMapping("/updateStudent")
    public Student updateStudent(@RequestBody Student student) {
        return studentService.saveStudent(student);
    }

    @Operation(summary = "Delete a student", description = "Deletes the student with the given id")
    @ApiResponse(responseCode = "200", description = "Student deleted successfully")
    @DeleteMapping("/deleteStudent/{id}")
    public void deleteStudent(@Parameter(description = "Id of the student to delete") @PathVariable Long id) { studentService.deleteStudent(id); }
}

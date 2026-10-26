package tn.fst.studentmanagement.controllers;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import tn.fst.studentmanagement.command.CreateEnrollmentCommand;
import tn.fst.studentmanagement.command.EnrollmentCommandService;
import tn.fst.studentmanagement.command.UpdateEnrollmentCommand;

/** Write endpoints only (POST, PUT, DELETE). */
@RestController
@RequestMapping("/Enrollment")
@RequiredArgsConstructor
public class EnrollmentCommandController {

    private final EnrollmentCommandService commandService;

    @PostMapping("/createEnrollment")
    @ResponseStatus(HttpStatus.CREATED)
    public Long createEnrollment(@RequestBody CreateEnrollmentCommand command) {
        return commandService.create(command);
    }

    @PutMapping("/updateEnrollment")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void updateEnrollment(@RequestBody UpdateEnrollmentCommand command) {
        commandService.update(command);
    }

    @DeleteMapping("/deleteEnrollment/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteEnrollment(@PathVariable Long id) {
        commandService.delete(id);
    }
}
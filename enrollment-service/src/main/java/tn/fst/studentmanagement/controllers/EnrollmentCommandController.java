package tn.fst.studentmanagement.controllers;

import org.axonframework.commandhandling.gateway.CommandGateway;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import tn.fst.studentmanagement.command.CreateEnrollmentCommand;
import tn.fst.studentmanagement.command.EnrollmentCommandService;
import tn.fst.studentmanagement.command.UpdateEnrollmentCommand;
import tn.fst.studentmanagement.axon.command.CreateAxonEnrollmentCommand;
import tn.fst.studentmanagement.axon.command.DeleteAxonEnrollmentCommand;
import tn.fst.studentmanagement.axon.command.UpdateAxonEnrollmentCommand;

/** Write endpoints only (POST, PUT, DELETE). */
@RestController
@RequestMapping("/Enrollment")
public class EnrollmentCommandController {

    private final EnrollmentCommandService commandService;
    private final CommandGateway commandGateway;

    public EnrollmentCommandController(EnrollmentCommandService commandService,
                                       CommandGateway commandGateway) {
        this.commandService = commandService;
        this.commandGateway = commandGateway;
    }

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

    @PostMapping("/axon")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public String createWithAxon(@RequestBody CreateAxonEnrollmentCommand command) {
        commandGateway.sendAndWait(command);
        return command.enrollmentId();
    }

    @PutMapping("/axon/{id}")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void updateWithAxon(@PathVariable String id, @RequestBody UpdateAxonEnrollmentCommand command) {
        commandGateway.sendAndWait(new UpdateAxonEnrollmentCommand(id, command.enrollmentDate(),
                command.grade(), command.status(), command.studentId(), command.courseId()));
    }

    @DeleteMapping("/axon/{id}")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void deleteWithAxon(@PathVariable String id) {
        commandGateway.sendAndWait(new DeleteAxonEnrollmentCommand(id));
    }
}
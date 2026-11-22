package tn.fst.studentmanagement.controllers;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.axonframework.commandhandling.gateway.CommandGateway;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import tn.fst.studentmanagement.axon.command.CreateAxonEnrollmentCommand;
import tn.fst.studentmanagement.axon.command.DeleteAxonEnrollmentCommand;
import tn.fst.studentmanagement.axon.command.UpdateAxonEnrollmentCommand;
import tn.fst.studentmanagement.command.CreateEnrollmentCommand;
import tn.fst.studentmanagement.command.EnrollmentCommandService;
import tn.fst.studentmanagement.command.UpdateEnrollmentCommand;

/** Write endpoints only (POST, PUT, DELETE). */
@RestController
@RequestMapping("/Enrollment")
@Tag(name = "Enrollment Commands",
        description = "Write side of the enrollment API: create, update and delete enrollments, "
                + "either directly or through Axon commands.")
public class EnrollmentCommandController {

    private final EnrollmentCommandService commandService;
    private final CommandGateway commandGateway;

    public EnrollmentCommandController(EnrollmentCommandService commandService,
                                       CommandGateway commandGateway) {
        this.commandService = commandService;
        this.commandGateway = commandGateway;
    }

    @Operation(summary = "Create an enrollment",
            description = "Persists a new enrollment via the command service and returns its id.")
    @PostMapping("/createEnrollment")
    @ResponseStatus(HttpStatus.CREATED)
    public Long createEnrollment(@RequestBody CreateEnrollmentCommand command) {
        return commandService.create(command);
    }

    @Operation(summary = "Update an enrollment",
            description = "Updates the enrollment identified by idEnrollment in the request body.")
    @PutMapping("/updateEnrollment")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void updateEnrollment(@RequestBody UpdateEnrollmentCommand command) {
        commandService.update(command);
    }

    @Operation(summary = "Delete an enrollment")
    @DeleteMapping("/deleteEnrollment/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteEnrollment(
            @Parameter(description = "Id of the enrollment to delete", example = "1") @PathVariable Long id) {
        commandService.delete(id);
    }

    @Operation(summary = "Create an enrollment with Axon",
            description = "Dispatches a CreateAxonEnrollmentCommand to the Axon aggregate and returns its id.")
    @PostMapping("/axon")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public String createWithAxon(@RequestBody CreateAxonEnrollmentCommand command) {
        commandGateway.sendAndWait(command);
        return command.enrollmentId();
    }

    @Operation(summary = "Update an enrollment with Axon",
            description = "Dispatches an UpdateAxonEnrollmentCommand to the aggregate identified by id.")
    @PutMapping("/axon/{id}")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void updateWithAxon(
            @Parameter(description = "Axon aggregate id") @PathVariable String id,
            @RequestBody UpdateAxonEnrollmentCommand command) {
        commandGateway.sendAndWait(new UpdateAxonEnrollmentCommand(id, command.enrollmentDate(),
                command.grade(), command.status(), command.studentId(), command.courseId()));
    }

    @Operation(summary = "Delete an enrollment with Axon",
            description = "Dispatches a DeleteAxonEnrollmentCommand to the aggregate identified by id.")
    @DeleteMapping("/axon/{id}")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void deleteWithAxon(
            @Parameter(description = "Axon aggregate id") @PathVariable String id) {
        commandGateway.sendAndWait(new DeleteAxonEnrollmentCommand(id));
    }
}

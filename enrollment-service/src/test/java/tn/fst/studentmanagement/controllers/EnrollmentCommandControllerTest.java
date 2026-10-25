package tn.fst.studentmanagement.controllers;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tn.fst.studentmanagement.command.CreateEnrollmentCommand;
import tn.fst.studentmanagement.command.EnrollmentCommandService;
import tn.fst.studentmanagement.command.UpdateEnrollmentCommand;
import tn.fst.studentmanagement.entities.Status;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EnrollmentCommandControllerTest {

    @Mock
    private EnrollmentCommandService commandService;

    @InjectMocks
    private EnrollmentCommandController controller;

    @Test
    void createEnrollment_delegatesToCommandService() {
        CreateEnrollmentCommand command = new CreateEnrollmentCommand(
                LocalDate.of(2025, 9, 1), 12.5, Status.ACTIVE, 1L, 2L);
        when(commandService.create(command)).thenReturn(42L);

        Long id = controller.createEnrollment(command);

        assertThat(id).isEqualTo(42L);
        verify(commandService).create(command);
    }

    @Test
    void updateEnrollment_delegatesToCommandService() {
        UpdateEnrollmentCommand command = new UpdateEnrollmentCommand(
                42L, LocalDate.of(2025, 9, 2), 15.0, Status.COMPLETED, 1L, 2L);

        controller.updateEnrollment(command);

        verify(commandService).update(command);
    }

    @Test
    void deleteEnrollment_delegatesToCommandService() {
        controller.deleteEnrollment(42L);

        verify(commandService).delete(42L);
    }
}
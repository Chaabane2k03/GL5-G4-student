package tn.fst.courseservice.service;

import org.junit.jupiter.api.Test;
import tn.fst.courseservice.client.DepartmentClient;
import tn.fst.courseservice.dto.DepartmentDto;
import tn.fst.courseservice.exception.DepartmentServiceUnavailableException;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for the resilience boundary around the department-service Feign client.
 */
class DepartmentLookupServiceTest {

    @Test
    void getDepartmentShouldDelegateToClient() {
        DepartmentClient client = mock(DepartmentClient.class);
        DepartmentDto dto = new DepartmentDto(2L, "CS", "Building A", "123", "Dr Smith");
        when(client.getDepartment(2L)).thenReturn(dto);

        DepartmentLookupService service = new DepartmentLookupService(client);

        assertThat(service.getDepartment(2L)).isSameAs(dto);
        verify(client).getDepartment(2L);
    }

    @Test
    void fallbackShouldTranslateAnyFailureIntoServiceUnavailable() throws Exception {
        DepartmentLookupService service = new DepartmentLookupService(mock(DepartmentClient.class));
        Method fallback = DepartmentLookupService.class
                .getDeclaredMethod("departmentFallback", Long.class, Throwable.class);
        fallback.setAccessible(true);

        assertThatThrownBy(() -> fallback.invoke(service, 2L, new RuntimeException("boom")))
                .isInstanceOf(InvocationTargetException.class)
                .hasCauseInstanceOf(DepartmentServiceUnavailableException.class)
                .hasRootCauseMessage("Department 2 could not be verified because "
                        + "department-service is unavailable; please retry");
    }
}

package tn.fst.configserver;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.hamcrest.Matchers;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(
        controllers = CsrfTokenController.class,
        properties = {
            "CONFIG_USER=test-user",
            "CONFIG_PASSWORD=test-password",
            "ENCRYPT_KEY=test-encryption-key"
        })
@Import(SecurityConfig.class)
class CsrfTokenControllerTest {

    @Autowired
    MockMvc mockMvc;

    @Test
    void csrfEndpointRequiresAuthentication() throws Exception {
        mockMvc.perform(get("/csrf"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser
    void returnsTokenAndHeaderNameForAuthenticatedRequests() throws Exception {
        mockMvc.perform(get("/csrf"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.headerName").value("X-CSRF-TOKEN"))
                .andExpect(jsonPath("$.token", Matchers.not(Matchers.blankOrNullString())));
    }
}

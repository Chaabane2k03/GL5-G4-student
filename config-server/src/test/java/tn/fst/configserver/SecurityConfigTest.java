package tn.fst.configserver;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

@WebMvcTest(
        properties = {
            "CONFIG_USER=test-user",
            "CONFIG_PASSWORD=test-password",
            "ENCRYPT_KEY=test-encryption-key"
        })
@Import({SecurityConfig.class, SecurityConfigTest.TestController.class})
class SecurityConfigTest {

    @Autowired
    MockMvc mockMvc;

    @Test
    void requiresAuthenticationForEveryRequest() throws Exception {
        mockMvc.perform(get("/protected"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser
    void allowsAuthenticatedRequests() throws Exception {
        mockMvc.perform(get("/protected"))
                .andExpect(status().isOk());
    }

    @Test
    @WithMockUser
    void rejectsPostRequestsWithoutCsrfToken() throws Exception {
        mockMvc.perform(post("/protected"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser
    void allowsPostRequestsWithCsrfToken() throws Exception {
        mockMvc.perform(post("/protected").with(csrf()))
                .andExpect(status().isOk());
    }

    @RestController
    public static class TestController {

        @GetMapping("/protected")
        public String get() {
            return "ok";
        }

        @PostMapping("/protected")
        public String post() {
            return "ok";
        }
    }
}

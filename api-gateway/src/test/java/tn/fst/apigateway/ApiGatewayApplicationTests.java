package tn.fst.apigateway;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
@org.springframework.context.annotation.Import(TestSecurityConfig.class)
class ApiGatewayApplicationTests {

    @Test
    void contextLoads() {
    }
}


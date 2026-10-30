package tn.fst.departmentservice.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfiguration {

    @Bean
    public OpenAPI departmentServiceOpenApi() {
        return new OpenAPI().info(new Info()
                .title("Department Service API")
                .version("v1")
                .description("API for managing departments independently of student and course services."));
    }
}

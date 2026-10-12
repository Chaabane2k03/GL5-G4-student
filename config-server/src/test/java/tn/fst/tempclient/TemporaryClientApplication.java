package tn.fst.tempclient;

import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Throwaway client microservice. It carries no configuration of its own other
 * than the coordinates of the Config Server: everything it exposes is resolved
 * from the remote Git-backed configuration at startup.
 */
@SpringBootApplication
@RestController
public class TemporaryClientApplication {

    private final String datasourceUrl;
    private final String ddlAuto;
    private final String applicationName;

    public TemporaryClientApplication(
            @Value("${spring.datasource.url:}") String datasourceUrl,
            @Value("${spring.jpa.hibernate.ddl-auto:}") String ddlAuto,
            @Value("${spring.application.name:}") String applicationName) {
        this.datasourceUrl = datasourceUrl;
        this.ddlAuto = ddlAuto;
        this.applicationName = applicationName;
    }

    public static void main(String[] args) {
        SpringApplication.run(TemporaryClientApplication.class, args);
    }

    @Bean
    SecurityFilterChain temporaryClientSecurityFilterChain(HttpSecurity http) throws Exception {
        http.authorizeHttpRequests(authorize -> authorize.anyRequest().permitAll());
        return http.build();
    }

    @GetMapping("/info")
    public Map<String, String> info() {
        Map<String, String> info = new LinkedHashMap<>();
        info.put("application", applicationName);
        info.put("datasourceUrl", datasourceUrl);
        info.put("ddlAuto", ddlAuto);
        return info;
    }
}

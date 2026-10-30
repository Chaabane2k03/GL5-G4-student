package tn.fst.apigateway;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.ReactiveJwtDecoder;
import reactor.core.publisher.Mono;
import tn.fst.apigateway.security.AudienceValidator;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@TestConfiguration
public class TestSecurityConfig {

    public static final String ADMIN_TOKEN = createToken("admin-user", List.of("ADMIN", "USER"), List.of("api-gateway"), null);
    public static final String TEACHER_TOKEN = createToken("teacher-user", List.of("TEACHER", "USER"), List.of("api-gateway"), null);
    public static final String STUDENT_TOKEN = createToken("student-user", List.of("STUDENT", "USER"), List.of("api-gateway"), List.of("/students"));
    public static final String REGULAR_USER_TOKEN = createToken("regular-user", List.of("USER"), List.of("api-gateway"), null);
    public static final String WRONG_AUDIENCE_TOKEN = createToken("other-client-user", List.of("ADMIN"), List.of("unrelated-client"), null);
    public static final String UNRELATED_CLIENT_ADMIN_TOKEN = createTokenWithClientRoles("unrelated-user", "other-service", List.of("admin"));
    public static final String INVALID_TOKEN = "invalid.token.signature";

    public static String createToken(String username, List<String> roles, List<String> audience, List<String> groups) {
        String header = Base64.getUrlEncoder().withoutPadding()
                .encodeToString("{\"alg\":\"none\",\"typ\":\"JWT\"}".getBytes(StandardCharsets.UTF_8));

        String rolesJson = roles.stream().map(r -> "\"" + r + "\"").collect(Collectors.joining(","));
        String audJson = audience.stream().map(a -> "\"" + a + "\"").collect(Collectors.joining(","));
        String groupsJson = groups != null ? groups.stream().map(g -> "\"" + g + "\"").collect(Collectors.joining(",")) : "";

        String payloadJson = "{\"sub\":\"" + username + "\",\"preferred_username\":\"" + username
                + "\",\"aud\":[" + audJson + "],\"realm_access\":{\"roles\":[" + rolesJson + "]},\"roles\":[" + rolesJson + "]"
                + (groups != null ? ",\"groups\":[" + groupsJson + "]" : "")
                + ",\"scope\":\"read write\"}";

        String payload = Base64.getUrlEncoder().withoutPadding()
                .encodeToString(payloadJson.getBytes(StandardCharsets.UTF_8));

        return header + "." + payload + ".signature";
    }

    public static String createTokenWithClientRoles(String username, String clientName, List<String> clientRoles) {
        String header = Base64.getUrlEncoder().withoutPadding()
                .encodeToString("{\"alg\":\"none\",\"typ\":\"JWT\"}".getBytes(StandardCharsets.UTF_8));

        String rolesJson = clientRoles.stream().map(r -> "\"" + r + "\"").collect(Collectors.joining(","));

        String payloadJson = "{\"sub\":\"" + username + "\",\"preferred_username\":\"" + username
                + "\",\"aud\":[\"api-gateway\"],\"resource_access\":{\"" + clientName + "\":{\"roles\":[" + rolesJson + "]}},\"roles\":[],\"scope\":\"read\"}";

        String payload = Base64.getUrlEncoder().withoutPadding()
                .encodeToString(payloadJson.getBytes(StandardCharsets.UTF_8));

        return header + "." + payload + ".signature";
    }

    @Bean
    @Primary
    public ReactiveJwtDecoder testReactiveJwtDecoder() {
        AudienceValidator audienceValidator = new AudienceValidator("api-gateway");

        return token -> {
            if (INVALID_TOKEN.equals(token)) {
                return Mono.error(new BadJwtException("Invalid token signature or expired"));
            }

            Instant issuedAt = Instant.now();
            Instant expiresAt = issuedAt.plusSeconds(3600);
            Map<String, Object> headers = Map.of("alg", "none", "typ", "JWT");

            List<String> realmRoles;
            List<String> audience;
            List<String> groups = Collections.emptyList();
            Map<String, Object> resourceAccess = Collections.emptyMap();
            String username;

            if (ADMIN_TOKEN.equals(token)) {
                username = "admin-user";
                realmRoles = List.of("ADMIN", "USER");
                audience = List.of("api-gateway");
            } else if (TEACHER_TOKEN.equals(token)) {
                username = "teacher-user";
                realmRoles = List.of("TEACHER", "USER");
                audience = List.of("api-gateway");
            } else if (STUDENT_TOKEN.equals(token)) {
                username = "student-user";
                realmRoles = List.of("STUDENT", "USER");
                audience = List.of("api-gateway");
                groups = List.of("/students");
            } else if (WRONG_AUDIENCE_TOKEN.equals(token)) {
                username = "wrong-aud-user";
                realmRoles = List.of("ADMIN");
                audience = List.of("unrelated-client");
            } else if (UNRELATED_CLIENT_ADMIN_TOKEN.equals(token)) {
                username = "unrelated-user";
                realmRoles = Collections.emptyList();
                audience = List.of("api-gateway");
                resourceAccess = Map.of("other-service", Map.of("roles", List.of("admin")));
            } else {
                username = "regular-user";
                realmRoles = List.of("USER");
                audience = List.of("api-gateway");
            }

            Map<String, Object> claims = new java.util.HashMap<>();
            claims.put("sub", username);
            claims.put("preferred_username", username);
            claims.put("aud", audience);
            claims.put("realm_access", Map.of("roles", realmRoles));
            claims.put("roles", realmRoles);
            claims.put("scope", "read write");
            if (!groups.isEmpty()) {
                claims.put("groups", groups);
            }
            if (!resourceAccess.isEmpty()) {
                claims.put("resource_access", resourceAccess);
            }

            Jwt jwt = new Jwt(token, issuedAt, expiresAt, headers, claims);
            if (audienceValidator.validate(jwt).hasErrors()) {
                return Mono.error(new BadJwtException("Audience validation failed"));
            }

            return Mono.just(jwt);
        };
    }
}

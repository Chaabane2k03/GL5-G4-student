package tn.fst.apigateway.security;

import org.springframework.core.convert.converter.Converter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;

import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * Extracts granted authorities from an OAuth2 JWT access token.
 *
 * Security improvements:
 * 1. Scopes client-role extraction strictly to {@code targetClientId} (default: "api-gateway")
 *    preventing cross-client role pollution where unrelated client roles (e.g. from an admin tool)
 *    grant unintended privileges on this gateway.
 * 2. Normalizes Keycloak group paths (e.g., "/admins" -> "ROLE_ADMINS" and "ROLE_ADMIN",
 *    "/school/teachers" -> "ROLE_SCHOOL_TEACHERS").
 * 3. Preserves standard OAuth2 scopes (prefixed with SCOPE_).
 */
public class GrantedAuthoritiesExtractor implements Converter<Jwt, Collection<GrantedAuthority>> {

    private final String targetClientId;
    private final JwtGrantedAuthoritiesConverter defaultAuthoritiesConverter = new JwtGrantedAuthoritiesConverter();

    public GrantedAuthoritiesExtractor(String targetClientId) {
        this.targetClientId = targetClientId;
    }

    public GrantedAuthoritiesExtractor() {
        this("api-gateway");
    }

    @Override
    public Collection<GrantedAuthority> convert(Jwt jwt) {
        Collection<GrantedAuthority> standardAuthorities = defaultAuthoritiesConverter.convert(jwt);
        Collection<GrantedAuthority> roleAuthorities = extractRoles(jwt);

        return Stream.concat(
                Objects.requireNonNullElse(standardAuthorities, List.<GrantedAuthority>of()).stream(),
                roleAuthorities.stream()
        ).collect(Collectors.toSet());
    }

    @SuppressWarnings("unchecked")
    private Collection<GrantedAuthority> extractRoles(Jwt jwt) {
        Set<String> rawRoles = new HashSet<>();

        // 1. Keycloak realm_access.roles
        Map<String, Object> realmAccess = jwt.getClaim("realm_access");
        if (realmAccess != null && realmAccess.get("roles") instanceof Collection<?> realmRoles) {
            realmRoles.forEach(r -> addNormalizedRole(rawRoles, String.valueOf(r)));
        }

        // 2. Keycloak resource_access.<targetClientId>.roles ONLY
        // Prevents privilege escalation from unrelated clients in the same realm
        Map<String, Object> resourceAccess = jwt.getClaim("resource_access");
        if (resourceAccess != null && targetClientId != null && !targetClientId.isBlank()) {
            Object clientResource = resourceAccess.get(targetClientId);
            if (clientResource instanceof Map<?, ?> clientMap
                    && clientMap.get("roles") instanceof Collection<?> clientRoles) {
                clientRoles.forEach(r -> addNormalizedRole(rawRoles, String.valueOf(r)));
            }
        }

        // 3. Direct "roles" claim
        Object directRoles = jwt.getClaim("roles");
        if (directRoles instanceof Collection<?> directRolesList) {
            directRolesList.forEach(r -> addNormalizedRole(rawRoles, String.valueOf(r)));
        }

        // 4. "groups" claim (Keycloak group paths like "/admins", "/teachers", "/department/staff")
        Object groups = jwt.getClaim("groups");
        if (groups instanceof Collection<?> groupsList) {
            groupsList.forEach(g -> addNormalizedGroup(rawRoles, String.valueOf(g)));
        }

        return rawRoles.stream()
                .map(String::trim)
                .filter(r -> !r.isEmpty())
                .map(r -> r.startsWith("ROLE_") ? r.toUpperCase() : "ROLE_" + r.toUpperCase())
                .map(SimpleGrantedAuthority::new)
                .collect(Collectors.toSet());
    }

    private void addNormalizedRole(Set<String> rawRoles, String role) {
        if (!role.isBlank()) {
            rawRoles.add(role.trim());
        }
    }

    private void addNormalizedGroup(Set<String> rawRoles, String group) {
        if (group.isBlank()) {
            return;
        }
        // Normalize Keycloak group paths: "/admins" -> "ADMINS", "/school/teachers" -> "SCHOOL_TEACHERS"
        String normalized = group.trim();
        if (normalized.startsWith("/")) {
            normalized = normalized.substring(1);
        }
        normalized = normalized.replace('/', '_');
        rawRoles.add(normalized);

        // Map plural group names to singular role equivalents (ADMINS -> ADMIN, TEACHERS -> TEACHER)
        String upper = normalized.toUpperCase();
        if (upper.endsWith("S") && upper.length() > 2) {
            rawRoles.add(upper.substring(0, upper.length() - 1));
        }
    }

    public String getTargetClientId() {
        return targetClientId;
    }
}

package tn.fst.apigateway.security;

import org.junit.jupiter.api.Test;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

class GrantedAuthoritiesExtractorTest {

    private static Jwt jwt(Map<String, Object> claims) {
        return Jwt.withTokenValue("token")
                .header("alg", "none")
                .claims(map -> map.putAll(claims))
                .build();
    }

    private static Set<String> authorities(GrantedAuthoritiesExtractor extractor, Jwt jwt) {
        return extractor.convert(jwt).stream()
                .map(GrantedAuthority::getAuthority)
                .collect(Collectors.toSet());
    }

    @Test
    void defaultsToTheApiGatewayClient() {
        assertThat(new GrantedAuthoritiesExtractor().getTargetClientId()).isEqualTo("api-gateway");
    }

    @Test
    void keepsStandardScopesAndNormalizesRealmRoles() {
        Jwt jwt = jwt(Map.of(
                "scope", "read write",
                "realm_access", Map.of("roles", List.of("ADMIN", "user"))));

        Set<String> authorities = authorities(new GrantedAuthoritiesExtractor("api-gateway"), jwt);

        assertThat(authorities).contains("SCOPE_read", "SCOPE_write", "ROLE_ADMIN", "ROLE_USER");
    }

    @Test
    void ignoresRolesFromUnrelatedClients() {
        Jwt jwt = jwt(Map.of(
                "aud", List.of("api-gateway"),
                "roles", List.of(),
                "resource_access", Map.of("other-service", Map.of("roles", List.of("admin")))));

        Set<String> authorities = authorities(new GrantedAuthoritiesExtractor("api-gateway"), jwt);

        assertThat(authorities).doesNotContain("ROLE_ADMIN");
    }

    @Test
    void readsRolesFromTheTargetClient() {
        Jwt jwt = jwt(Map.of(
                "resource_access", Map.of("api-gateway", Map.of("roles", List.of("gateway-admin")))));

        Set<String> authorities = authorities(new GrantedAuthoritiesExtractor("api-gateway"), jwt);

        assertThat(authorities).contains("ROLE_GATEWAY-ADMIN");
    }

    @Test
    void ignoresNonCollectionRoleAndGroupClaims() {
        Jwt jwt = jwt(Map.of(
                "realm_access", Map.of("roles", "not-a-collection"),
                "roles", "not-a-collection",
                "groups", "not-a-collection"));

        Set<String> authorities = authorities(new GrantedAuthoritiesExtractor("api-gateway"), jwt);

        assertThat(authorities).isEmpty();
    }

    @Test
    void ignoresMalformedResourceAccessEntries() {
        GrantedAuthoritiesExtractor extractor = new GrantedAuthoritiesExtractor("api-gateway");

        Set<String> notAMap = authorities(extractor, jwt(Map.of(
                "resource_access", Map.of("api-gateway", "not-a-map"))));
        Set<String> rolesNotACollection = authorities(extractor, jwt(Map.of(
                "resource_access", Map.of("api-gateway", Map.of("roles", "not-a-collection")))));

        assertThat(notAMap).isEmpty();
        assertThat(rolesNotACollection).isEmpty();
    }

    @Test
    void skipsClientRoleExtractionWhenTheTargetClientIsMissing() {
        Map<String, Object> claims = Map.of(
                "resource_access", Map.of("api-gateway", Map.of("roles", List.of("admin"))));

        Set<String> nullClient = authorities(new GrantedAuthoritiesExtractor(null), jwt(claims));
        Set<String> blankClient = authorities(new GrantedAuthoritiesExtractor("   "), jwt(claims));

        assertThat(nullClient).isEmpty();
        assertThat(blankClient).isEmpty();
    }

    @Test
    void normalizesDirectRoleClaimsAndDropsBlankEntries() {
        Jwt jwt = jwt(Map.of(
                "roles", List.of("ROLE_ADMIN", " teacher ", "   ")));

        Set<String> authorities = authorities(new GrantedAuthoritiesExtractor("api-gateway"), jwt);

        assertThat(authorities).contains("ROLE_ADMIN", "ROLE_TEACHER");
    }

    @Test
    void normalizesGroupPathsToSingleAndPluralRoles() {
        Jwt jwt = jwt(Map.of(
                "groups", List.of("/admins", "school/teachers", "/", "   ", "S")));

        Set<String> authorities = authorities(new GrantedAuthoritiesExtractor("api-gateway"), jwt);

        assertThat(authorities).contains(
                "ROLE_ADMINS",
                "ROLE_ADMIN",
                "ROLE_SCHOOL_TEACHERS",
                "ROLE_SCHOOL_TEACHER",
                "ROLE_S");
    }

    @Test
    void convertsATokenWithoutRolesToAnEmptyAuthorityCollection() {
        Collection<GrantedAuthority> authorities =
                new GrantedAuthoritiesExtractor("api-gateway")
                        .convert(jwt(Map.of("iss", "http://issuer.example")));

        assertThat(authorities).isEmpty();
    }
}

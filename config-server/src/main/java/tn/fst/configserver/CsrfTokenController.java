package tn.fst.configserver;

import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Exposes the current session's CSRF token so authenticated clients (for
 * example scripts calling {@code /encrypt} or {@code /decrypt}) can obtain a
 * token and then include it on state-changing requests.
 *
 * <p>The token is bound to the HTTP session created for this request: clients
 * must retain the session cookie returned here and send it on the following
 * POST together with the token in the header reported by
 * {@link CsrfTokenResponse#headerName()}.</p>
 */
@RestController
public class CsrfTokenController {

    @GetMapping("/csrf")
    public CsrfTokenResponse csrf(CsrfToken token) {
        return new CsrfTokenResponse(token.getHeaderName(), token.getToken());
    }

    /** CSRF token value and the header it must be sent in. */
    public record CsrfTokenResponse(String headerName, String token) {
    }
}

import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { ConfigService } from '../config/runtime-config';

/**
 * Intercepteur fonctionnel d'authentification :
 * Attache le jeton Bearer UNIQUEMENT aux requêtes dirigées vers l'API Gateway.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const configService = inject(ConfigService);
  const gatewayUrl = configService.apiBaseUrl;

  // Vérification stricte : la requête cible-t-elle l'API Gateway ?
  const isGatewayRequest = req.url.startsWith(gatewayUrl) || req.url.startsWith('/api') || req.url.startsWith('/department') || req.url.startsWith('/student') || req.url.startsWith('/course') || req.url.startsWith('/enrollment') || req.url.startsWith('/Enrollment');

  if (!isGatewayRequest) {
    return next(req);
  }

  const currentToken = authService.token();

  if (!currentToken) {
    return next(req);
  }

  // Tenter un rafraîchissement proactif si le token est sur le point d'expirer (< 10s)
  return from(authService.updateToken(10)).pipe(
    switchMap(token => {
      const activeToken = token || currentToken;
      const authReq = req.clone({
        setHeaders: {
          Authorization: `Bearer ${activeToken}`,
        },
      });
      return next(authReq);
    }),
  );
};

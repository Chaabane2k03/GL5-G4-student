import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isInitialized()) {
    await authService.init();
  }

  if (authService.isAuthenticated()) {
    return true;
  }

  return router.parseUrl('/connexion');
};

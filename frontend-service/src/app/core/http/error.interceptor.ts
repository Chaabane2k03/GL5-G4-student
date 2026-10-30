import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { AppError, normalizeHttpError } from '../error/app-error';

export interface ServiceUnavailableNotice {
  serviceName: string;
  retryAction?: () => void;
}

@Injectable({
  providedIn: 'root',
})
export class ErrorNotificationService {
  readonly serviceUnavailable = signal<ServiceUnavailableNotice | null>(null);

  showServiceUnavailable(serviceName: string, retryAction?: () => void): void {
    this.serviceUnavailable.set({ serviceName, retryAction });
  }

  dismissServiceUnavailable(): void {
    this.serviceUnavailable.set(null);
  }
}

/**
 * Détermine le nom du microservice ciblé à partir de l'URL
 */
function extractServiceNameFromUrl(url: string): string {
  if (url.includes('/department')) return 'Départements';
  if (url.includes('/student')) return 'Étudiants';
  if (url.includes('/course')) return 'Cours';
  if (url.includes('/enrollment') || url.includes('/Enrollment')) return 'Inscriptions';
  return 'Système';
}

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const errorNotification = inject(ErrorNotificationService);
  const serviceName = extractServiceNameFromUrl(req.url);

  return next(req).pipe(
    catchError((error: unknown) => {
      let normalized: AppError;

      if (error instanceof HttpErrorResponse) {
        normalized = normalizeHttpError(
          {
            status: error.status,
            error: error.error,
            message: error.message,
          },
          serviceName,
        );

        if (error.status === 401) {
          authService.isSessionExpired.set(true);
        } else if (error.status === 403) {
          void router.navigate(['/403']);
        } else if (error.status === 503 || error.status === 504 || error.status === 0) {
          errorNotification.showServiceUnavailable(serviceName);
        }
      } else {
        normalized = normalizeHttpError(error, serviceName);
      }

      return throwError(() => normalized);
    }),
  );
};

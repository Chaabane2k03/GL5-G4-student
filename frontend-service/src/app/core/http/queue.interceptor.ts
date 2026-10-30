import { HttpEvent, HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { defer, finalize, Observable, ReplaySubject, switchMap } from 'rxjs';

/**
 * File d'attente à concurrence contrôlée :
 * Ne déclenche jamais plus de 4 requêtes HTTP simultanées pour préserver le quota
 * de l'API Gateway (20 req/s, rate-limiter, disjoncteur 503).
 */
@Injectable({
  providedIn: 'root',
})
export class RequestQueueService {
  private readonly MAX_CONCURRENT = 4;
  private inFlight = 0;
  private readonly queue: (() => void)[] = [];

  execute<T>(fn: () => Observable<T>): Observable<T> {
    return defer(() => {
      const start$ = new ReplaySubject<void>(1);
      let started = false;

      const run = () => {
        started = true;
        this.inFlight++;
        start$.next();
        start$.complete();
      };

      if (this.inFlight < this.MAX_CONCURRENT) {
        run();
      } else {
        this.queue.push(run);
      }

      return start$.pipe(
        switchMap(() => fn()),
        finalize(() => {
          if (!started) {
            const index = this.queue.indexOf(run);
            if (index >= 0) {
              this.queue.splice(index, 1);
            }
            return;
          }

          this.inFlight--;
          if (this.queue.length > 0 && this.inFlight < this.MAX_CONCURRENT) {
            const nextInQueue = this.queue.shift();
            if (nextInQueue) {
              nextInQueue();
            }
          }
        }),
      );
    });
  }
}

export const queueInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn): Observable<HttpEvent<unknown>> => {
  const queueService = inject(RequestQueueService);
  return queueService.execute(() => next(req));
};

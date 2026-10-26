import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { cleanedUrlWithoutOidcFragment } from './core/auth/oidc-url';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <router-outlet></router-outlet>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      width: 100%;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    const navigationSubscription = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => this.clearOidcFragment());

    this.destroyRef.onDestroy(() => navigationSubscription.unsubscribe());
  }

  private clearOidcFragment(): void {
    const cleanUrl = cleanedUrlWithoutOidcFragment(window.location);
    if (cleanUrl) {
      window.history.replaceState(window.history.state, '', cleanUrl);
    }
  }
}

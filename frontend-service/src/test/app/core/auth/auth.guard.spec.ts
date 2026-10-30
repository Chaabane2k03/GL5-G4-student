import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../../../../app/core/auth/auth.service';
import { authGuard } from '../../../../app/core/auth/auth.guard';

describe('authGuard', () => {
  const route = {} as ActivatedRouteSnapshot;
  const state = {} as RouterStateSnapshot;
  let authService: {
    isInitialized: jasmine.Spy;
    isAuthenticated: jasmine.Spy;
    init: jasmine.Spy;
  };
  let router: { parseUrl: jasmine.Spy };

  beforeEach(() => {
    authService = {
      isInitialized: jasmine.createSpy('isInitialized').and.returnValue(true),
      isAuthenticated: jasmine.createSpy('isAuthenticated').and.returnValue(true),
      init: jasmine.createSpy('init').and.resolveTo(true),
    };
    router = {
      parseUrl: jasmine.createSpy('parseUrl').and.returnValue({ url: '/connexion' }),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router },
      ],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('allows an already authenticated session', async () => {
    const result = await TestBed.runInInjectionContext(() => authGuard(route, state));

    expect(result).toBeTrue();
    expect(authService.init).not.toHaveBeenCalled();
  });

  it('initializes an uninitialized session before allowing it', async () => {
    authService.isInitialized.and.returnValue(false);

    const result = await TestBed.runInInjectionContext(() => authGuard(route, state));

    expect(authService.init).toHaveBeenCalled();
    expect(result).toBeTrue();
  });

  it('redirects an unauthenticated session to the login page', async () => {
    authService.isAuthenticated.and.returnValue(false);

    const result = await TestBed.runInInjectionContext(() => authGuard(route, state));

    expect(router.parseUrl).toHaveBeenCalledWith('/connexion');
    expect((result as unknown as { url: string }).url).toBe('/connexion');
  });
});

import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthService } from '../../../../app/core/auth/auth.service';
import { ConfigService } from '../../../../app/core/config/runtime-config';
import { ConnexionComponent } from '../../../../app/features/auth/connexion.component';

describe('ConnexionComponent', () => {
  let fixture: ComponentFixture<ConnexionComponent>;

  const authServiceMock = {
    isAuthenticated: signal(false),
    isKeycloakAvailable: signal(true),
    authServerUrl: signal('http://localhost:8080'),
    login: jasmine.createSpy('login').and.resolveTo(),
    retryConnection: jasmine.createSpy('retryConnection').and.resolveTo(false),
  };

  const configServiceMock = {
    loadError: signal<string | null>(null),
  };

  const routerMock = {
    navigate: jasmine.createSpy('navigate'),
  };

  beforeEach(async () => {
    authServiceMock.isAuthenticated.set(false);
    authServiceMock.isKeycloakAvailable.set(true);
    routerMock.navigate.calls.reset();

    await TestBed.configureTestingModule({
      imports: [ConnexionComponent],
      providers: [
        { provide: AuthService, useValue: authServiceMock },
        { provide: ConfigService, useValue: configServiceMock },
        { provide: Router, useValue: routerMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ConnexionComponent);
    fixture.detectChanges();
  });

  it('resets transient loading states when the page is restored', () => {
    const component = fixture.componentInstance;
    component.connecting.set(true);
    component.retrying.set(true);

    window.dispatchEvent(new PageTransitionEvent('pageshow'));

    expect(component.connecting()).toBeFalse();
    expect(component.retrying()).toBeFalse();
  });

  it('uses the simplified login label and footer', () => {
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Se connecter');
    expect(text).not.toContain('Se connecter avec Keycloak');
    expect(text).toContain("Université — Tous droits d'accès réservés");
    expect(text).not.toContain('Protocole OAuth2 / OIDC avec vérification PKCE (S256)');
  });

  it('redirects an authenticated user to the dashboard on init', () => {
    authServiceMock.isAuthenticated.set(true);

    fixture.componentInstance.ngOnInit();

    expect(routerMock.navigate).toHaveBeenCalledWith(['/tableau-de-bord']);
  });

  it('redirects after a successful Keycloak retry', async () => {
    authServiceMock.isAuthenticated.set(true);

    await fixture.componentInstance.retryKeycloak();

    expect(routerMock.navigate).toHaveBeenCalledWith(['/tableau-de-bord']);
  });

  it('delegates connect to authService.login', async () => {
    await fixture.componentInstance.connect();
    expect(authServiceMock.login).toHaveBeenCalled();
  });
});

import { TestBed } from '@angular/core/testing';
import { HeaderComponent } from '../../../../app/layout/header/header.component';
import { authService, configureLayoutTestBed } from '../layout-test-harness';

describe('HeaderComponent', () => {
  beforeEach(() => configureLayoutTestBed());
  afterEach(() => TestBed.resetTestingModule());

  it('exposes the current user and toggles its menu', () => {
    const fixture = TestBed.createComponent(HeaderComponent);
    const component = fixture.componentInstance;

    expect(component.userName()).toBe('Ada Lovelace');
    expect(component.userEmail()).toBe('ada@example.com');

    component.toggleMenu();
    expect(component.menuOpen()).toBeTrue();
    component.toggleMenu();
    expect(component.menuOpen()).toBeFalse();
  });

  it('closes the menu on outside clicks only', () => {
    const fixture = TestBed.createComponent(HeaderComponent);
    const component = fixture.componentInstance;
    const inside = document.createElement('div');
    inside.className = 'user-profile-menu';
    const outside = document.createElement('div');

    component.menuOpen.set(true);
    component.onDocumentClick({ target: inside } as unknown as MouseEvent);
    expect(component.menuOpen()).toBeTrue();

    component.onDocumentClick({ target: outside } as unknown as MouseEvent);
    expect(component.menuOpen()).toBeFalse();
  });

  it('closes the menu before logging out', async () => {
    const fixture = TestBed.createComponent(HeaderComponent);
    const component = fixture.componentInstance;
    component.menuOpen.set(true);

    await component.onLogout();

    expect(component.menuOpen()).toBeFalse();
    expect(authService.logout).toHaveBeenCalled();
  });
});

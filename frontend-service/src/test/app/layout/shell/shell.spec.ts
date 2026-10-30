import { TestBed } from '@angular/core/testing';
import { ShellComponent } from '../../../../app/layout/shell/shell.component';
import { authService, configureLayoutTestBed } from '../layout-test-harness';

describe('ShellComponent', () => {
  beforeEach(() => configureLayoutTestBed());
  afterEach(() => TestBed.resetTestingModule());

  it('handles keyboard shortcuts and search state', () => {
    const fixture = TestBed.createComponent(ShellComponent);
    const component = fixture.componentInstance;
    const preventDefault = jasmine.createSpy('preventDefault');

    component.onGlobalKeydown({
      ctrlKey: true,
      metaKey: false,
      key: 'k',
      preventDefault,
    } as unknown as KeyboardEvent);
    expect(component.isSearchOpen()).toBeTrue();
    expect(preventDefault).toHaveBeenCalled();

    component.onGlobalKeydown({
      ctrlKey: false,
      metaKey: true,
      key: 'K',
      preventDefault,
    } as unknown as KeyboardEvent);
    expect(component.isSearchOpen()).toBeFalse();

    component.onGlobalKeydown({
      ctrlKey: false,
      metaKey: false,
      key: 'k',
      preventDefault,
    } as unknown as KeyboardEvent);
    expect(component.isSearchOpen()).toBeFalse();

    component.openSearch();
    expect(component.isSearchOpen()).toBeTrue();
    component.closeSearch();
    expect(component.isSearchOpen()).toBeFalse();
    component.toggleSearch();
    expect(component.isSearchOpen()).toBeTrue();
  });

  it('reconnects the expired session', async () => {
    const fixture = TestBed.createComponent(ShellComponent);

    await fixture.componentInstance.reconnect();

    expect(authService.closeSessionExpiredModal).toHaveBeenCalled();
    expect(authService.login).toHaveBeenCalled();
  });
});

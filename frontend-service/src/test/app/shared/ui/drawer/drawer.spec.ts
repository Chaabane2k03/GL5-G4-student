import { TestBed } from '@angular/core/testing';
import { setup } from '../ui-test-harness';
import { DrawerComponent } from '../../../../../app/shared/ui/drawer/drawer.component';

describe('DrawerComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('DrawerComponent closes on escape only while open', async () => {
    const fixture = await setup(DrawerComponent);
    const component = fixture.componentInstance;
    let closed = 0;
    component.closed.subscribe(() => closed++);

    component.onEscape();
    expect(closed).toBe(0);

    fixture.componentRef.setInput('isOpen', true);
    component.onEscape();
    component.onBackdropClick();
    expect(closed).toBe(2);
  });
});

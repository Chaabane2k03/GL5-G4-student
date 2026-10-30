import { TestBed } from '@angular/core/testing';
import { setup } from '../ui-test-harness';
import { ModalComponent } from '../../../../../app/shared/ui/modal/modal.component';

describe('ModalComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('ModalComponent honours escape, backdrop and close settings', async () => {
    const fixture = await setup(ModalComponent);
    const component = fixture.componentInstance;
    let closed = 0;
    component.closed.subscribe(() => closed++);
    const element = document.createElement('div');
    const backdropEvent = {
      target: element,
      currentTarget: element,
    } as unknown as MouseEvent;

    component.onEscape();
    component.onBackdropClick(backdropEvent);
    expect(closed).toBe(0);

    fixture.componentRef.setInput('isOpen', true);
    component.onEscape();
    expect(closed).toBe(1);

    component.onBackdropClick(backdropEvent);
    expect(closed).toBe(2);

    fixture.componentRef.setInput('closeOnBackdrop', false);
    component.onBackdropClick(backdropEvent);
    expect(closed).toBe(2);

    component.onClose();
    expect(closed).toBe(3);
  });
});

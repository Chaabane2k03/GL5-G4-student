import { TestBed } from '@angular/core/testing';
import { setup } from '../ui-test-harness';
import { ConfirmDialogComponent } from '../../../../../app/shared/ui/confirm-dialog/confirm-dialog.component';

describe('ConfirmDialogComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('ConfirmDialogComponent blocks actions while loading', async () => {
    const fixture = await setup(ConfirmDialogComponent);
    const component = fixture.componentInstance;
    let confirmed = 0;
    let cancelled = 0;
    component.confirmed.subscribe(() => confirmed++);
    component.cancelled.subscribe(() => cancelled++);

    fixture.componentRef.setInput('loading', true);
    component.onConfirm();
    component.onCancel();
    expect(confirmed).toBe(0);
    expect(cancelled).toBe(0);

    fixture.componentRef.setInput('loading', false);
    component.onConfirm();
    component.onCancel();
    expect(confirmed).toBe(1);
    expect(cancelled).toBe(1);
  });
});

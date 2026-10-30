import { TestBed } from '@angular/core/testing';
import { setup } from '../ui-test-harness';
import { SnackbarComponent } from '../../../../../app/shared/ui/snackbar/snackbar.component';
import { SnackbarService } from '../../../../../app/shared/ui/snackbar/snackbar.service';

describe('SnackbarComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('SnackbarComponent runs actions and dismisses toasts', async () => {
    const fixture = await setup(SnackbarComponent);
    const service = TestBed.inject(SnackbarService);
    const callback = jasmine.createSpy('callback');
    service.show('Undo', { durationMs: 0, action: { label: 'Undo', callback } });
    const toast = service.messages()[0];

    fixture.componentInstance.onAction(toast);
    expect(callback).toHaveBeenCalled();
    expect(service.messages()).toEqual([]);

    service.show('Dismiss me', { durationMs: 0 });
    const second = service.messages()[0];
    fixture.componentInstance.onDismiss(second.id);
    expect(service.messages()).toEqual([]);
  });
});

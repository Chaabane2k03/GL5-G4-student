import { TestBed } from '@angular/core/testing';
import { SnackbarService } from '../../../../../app/shared/ui/snackbar/snackbar.service';

describe('SnackbarService', () => {
  let service: SnackbarService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SnackbarService);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('adds a message to the signal and dismisses it by id', () => {
    const id = service.success('Test message');
    expect(service.messages().length).toBe(1);
    expect(service.messages()[0].message).toBe('Test message');

    service.dismiss(id);
    expect(service.messages().length).toBe(0);
  });

  it('supports every convenience method and auto-dismisses errors', () => {
    jasmine.clock().install();
    try {
      const successId = service.success('ok');
      const warningId = service.warning('warn');
      const infoId = service.info('info');
      const errorId = service.error('error');

      expect(service.messages().map(message => message.type)).toEqual([
        'success',
        'warning',
        'info',
        'error',
      ]);
      expect(successId).toBeTruthy();
      expect(warningId).toBeTruthy();
      expect(infoId).toBeTruthy();
      expect(errorId).toBeTruthy();

      jasmine.clock().tick(8000);
      expect(service.messages()).toEqual([]);
    } finally {
      jasmine.clock().uninstall();
    }
  });

  it('honours a custom duration and dismisses by id', () => {
    jasmine.clock().install();
    try {
      const id = service.show('custom', { durationMs: 100 });

      expect(service.messages().length).toBe(1);
      jasmine.clock().tick(100);
      expect(service.messages()).toEqual([]);

      const permanentId = service.show('permanent', { durationMs: 0 });
      service.dismiss(permanentId);
      expect(service.messages()).toEqual([]);
      expect(id).toBeTruthy();
    } finally {
      jasmine.clock().uninstall();
    }
  });

  it('does not schedule auto-dismiss when durationMs is 0', () => {
    spyOn(globalThis, 'setTimeout');
    service.show('Hello', { durationMs: 0 });
    expect(globalThis.setTimeout).not.toHaveBeenCalled();
  });
});

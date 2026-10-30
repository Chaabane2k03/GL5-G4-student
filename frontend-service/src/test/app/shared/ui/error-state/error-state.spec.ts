import { TestBed } from '@angular/core/testing';
import { setup } from '../ui-test-harness';
import { ErrorStateComponent } from '../../../../../app/shared/ui/error-state/error-state.component';

describe('ErrorStateComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('exposes its detail input', async () => {
    const fixture = await setup(ErrorStateComponent);
    fixture.componentRef.setInput('detail', 'Gateway down');

    expect(fixture.componentInstance.detail()).toBe('Gateway down');
  });
});

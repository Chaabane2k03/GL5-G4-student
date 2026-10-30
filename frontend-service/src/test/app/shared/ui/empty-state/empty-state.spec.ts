import { TestBed } from '@angular/core/testing';
import { setup } from '../ui-test-harness';
import { EmptyStateComponent } from '../../../../../app/shared/ui/empty-state/empty-state.component';

describe('EmptyStateComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('exposes its title and message inputs', async () => {
    const fixture = await setup(EmptyStateComponent);
    fixture.componentRef.setInput('title', 'Empty');
    fixture.componentRef.setInput('message', 'No data');

    expect(fixture.componentInstance.title()).toBe('Empty');
    expect(fixture.componentInstance.message()).toBe('No data');
  });
});

import { TestBed } from '@angular/core/testing';
import { setup } from '../ui-test-harness';
import { SkeletonComponent } from '../../../../../app/shared/ui/skeleton/skeleton.component';

describe('SkeletonComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('SkeletonComponent builds the requested row count', async () => {
    const fixture = await setup(SkeletonComponent);
    const component = fixture.componentInstance;

    fixture.componentRef.setInput('rows', 3);
    expect(component.rowArray()).toEqual([0, 1, 2]);

    fixture.componentRef.setInput('rows', 0);
    expect(component.rowArray()).toEqual([]);
  });
});

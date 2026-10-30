import { TestBed } from '@angular/core/testing';
import { setup } from '../ui-test-harness';
import { AvatarComponent } from '../../../../../app/shared/ui/avatar/avatar.component';

describe('AvatarComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('AvatarComponent derives initials for empty, single and full names', async () => {
    const fixture = await setup(AvatarComponent);
    const component = fixture.componentInstance;

    expect(component.initials()).toBe('ET');

    fixture.componentRef.setInput('name', 'Ada Lovelace');
    expect(component.initials()).toBe('AL');

    fixture.componentRef.setInput('name', 'Prince');
    expect(component.initials()).toBe('PR');

    fixture.componentRef.setInput('name', '   ');
    expect(component.initials()).toBe('ET');
  });
});

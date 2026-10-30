import { TestBed } from '@angular/core/testing';
import { setup } from '../ui-test-harness';
import { SearchFieldComponent } from '../../../../../app/shared/ui/search-field/search-field.component';

describe('SearchFieldComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('SearchFieldComponent emits typed and cleared values', async () => {
    const fixture = await setup(SearchFieldComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const values: string[] = [];
    component.valueChange.subscribe(value => values.push(value));
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    const focusSpy = spyOn(input, 'focus');

    component.onInput({ target: { value: 'alice' } } as unknown as Event);
    component.onClear();
    component.focus();

    expect(values).toEqual(['alice', '']);
    expect(focusSpy).toHaveBeenCalledTimes(2);
  });
});

import { TestBed } from '@angular/core/testing';
import { setup } from '../feature-test-harness';
import { ForbiddenComponent } from '../../../../app/features/errors/forbidden.component';
import { NotFoundComponent } from '../../../../app/features/errors/not-found.component';

describe('Error pages', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('covers error page navigation', async () => {
    const forbidden = await setup(ForbiddenComponent);
    forbidden.component.goToDashboard();
    expect(forbidden.mocks.router.navigate).toHaveBeenCalledWith(['/tableau-de-bord']);

    TestBed.resetTestingModule();
    const notFound = await setup(NotFoundComponent);
    notFound.component.goToDashboard();
    expect(notFound.mocks.router.navigate).toHaveBeenCalledWith(['/tableau-de-bord']);
  });
});

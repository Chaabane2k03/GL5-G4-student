import { isAppError, normalizeHttpError } from '../../../../app/core/error/app-error';

describe('AppError normalization', () => {
  it('recognizes an already normalized application error', () => {
    const error = { status: 400, message: 'Bad request' };

    expect(isAppError(error)).toBeTrue();
    expect(isAppError({ error: 'raw' })).toBeFalse();
    expect(isAppError(null)).toBeFalse();
    expect(isAppError('error')).toBeFalse();
    expect(normalizeHttpError(error)).toBe(error);
  });

  it('uses the Spring Boot message and maps field errors', () => {
    const error = normalizeHttpError(
      {
        status: 400,
        error: {
          message: 'Validation failed',
          fieldErrors: [
            { field: 'email', message: 'Invalid email' },
            { message: 'Missing field' },
          ],
        },
      },
      'Etudiants',
    );

    expect(error.status).toBe(400);
    expect(error.message).toBe('Validation failed');
    expect(error.fieldErrors).toEqual([
      { field: 'email', message: 'Invalid email' },
      { field: '', message: 'Missing field' },
    ]);
    expect(error.serviceName).toBe('Etudiants');
    expect(error.timestamp).toBeTruthy();
  });

  it('falls back to the Spring error field and the generic message', () => {
    expect(normalizeHttpError({ status: 400, error: { error: 'Bad input' } }).message).toBe(
      'Bad input',
    );
    expect(normalizeHttpError({ status: 400, error: {} }).message).toBe(
      'Une erreur inattendue est survenue.',
    );
    expect(normalizeHttpError({ status: 400, message: 'Transport error' }).message).toBe(
      'Transport error',
    );
  });

  it('maps unavailable services with and without a service name', () => {
    expect(normalizeHttpError({ status: 0 }, 'Cours').message).toBe(
      'Le service Cours est temporairement indisponible.',
    );
    expect(normalizeHttpError({ status: 503 }).message).toBe(
      'Le service est temporairement indisponible.',
    );
    expect(normalizeHttpError({ status: 504 }).message).toContain('indisponible');
  });

  it('maps common HTTP statuses to user-facing messages', () => {
    expect(normalizeHttpError({ status: 429 }).message).toContain('Trop de');
    expect(normalizeHttpError({ status: 403 }).message).toContain('refus');
    expect(normalizeHttpError({ status: 404 }).message).toContain('introuvable');
    expect(normalizeHttpError({ status: 409 }).message).toContain('Conflit');
    expect(normalizeHttpError({ status: 500 }).status).toBe(500);
  });

  it('normalizes non-object values without throwing', () => {
    const error = normalizeHttpError('unexpected');

    expect(error.status).toBe(0);
    expect(error.message).toBe('Le service est temporairement indisponible.');
    expect(error.fieldErrors).toBeUndefined();
  });

  it('maps direct message property on error object when response body is absent', () => {
    const err = normalizeHttpError({ message: 'Direct error message', status: 500 });
    expect(err.message).toBe('Direct error message');
  });

  it('covers all branch permutations for 409 and field errors', () => {
    expect(normalizeHttpError({ status: 409, error: null }).message).toBe('Conflit : cette ressource ou ce code existe déjà.');
    expect(normalizeHttpError({ status: 409, error: { error: 'Code déjà utilisé' } }).message).toBe('Code déjà utilisé');
    expect(normalizeHttpError({ status: 409, error: { message: 'Département existant' } }).message).toBe('Département existant');

    const errWithFieldOnly = normalizeHttpError({
      status: 400,
      error: { fieldErrors: [{ field: 'code' }, {}] }
    });
    expect(errWithFieldOnly.fieldErrors).toEqual([
      { field: 'code', message: '' },
      { field: '', message: '' }
    ]);
  });
});

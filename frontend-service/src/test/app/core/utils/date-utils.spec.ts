import {
  calculateAge,
  formatDateFrLong,
  formatDateFrShort,
  formatUtcDateTime,
  getAcademicYearKey,
  getAcademicYearLabel,
  parseDateString
} from '../../../../app/core/utils/date-utils';

describe('DateUtils (Timezone-safe & French Formatting)', () => {
  it('parseDateString safely parses standard yyyy-MM-dd strings', () => {
    expect(parseDateString(null)).toBeNull();
    expect(parseDateString(undefined)).toBeNull();
    expect(parseDateString('')).toBeNull();
    expect(parseDateString('invalid')).toBeNull();
    expect(parseDateString('2025-02')).toBeNull();
    expect(parseDateString('abcd-ef-gh')).toBeNull();

    const parts = parseDateString('2025-09-15');
    expect(parts).toEqual({ year: 2025, month: 9, day: 15 });

    const partsWithTime = parseDateString('2025-10-30T14:30:00');
    expect(partsWithTime).toEqual({ year: 2025, month: 10, day: 30 });
  });

  it('formatDateFrShort formats dates with abbreviated French month', () => {
    expect(formatDateFrShort(null)).toBe('—');
    expect(formatDateFrShort('')).toBe('—');
    expect(formatDateFrShort('invalid')).toBe('—');
    expect(formatDateFrShort('2025-01-05')).toBe('05 janv. 2025');
    expect(formatDateFrShort('2025-12-25')).toBe('25 déc. 2025');
  });

  it('formatDateFrLong formats dates with full French month', () => {
    expect(formatDateFrLong(null)).toBe('—');
    expect(formatDateFrLong('')).toBe('—');
    expect(formatDateFrLong('2025-07-14')).toBe('14 juillet 2025');
    expect(formatDateFrLong(undefined)).toBe('—');
  });

  it('calculateAge accurately computes student age without UTC discrepancies', () => {
    const refDate = new Date(2025, 9, 24); // 24 octobre 2025
    expect(calculateAge('2003-05-12', refDate)).toBe(22);
    expect(calculateAge('2003-11-15', refDate)).toBe(21); // Pas encore fêté en octobre
    expect(calculateAge('2003-10-24', refDate)).toBe(22); // Anniversaire aujourd'hui
    expect(calculateAge(null)).toBeNull();
  });

  it('getAcademicYearLabel produces correct university year string', () => {
    expect(getAcademicYearLabel(null)).toBe('Année indéterminée');
    expect(getAcademicYearLabel('')).toBe('Année indéterminée');
    expect(getAcademicYearLabel('2025-09-15')).toBe('Année universitaire 2025–2026');
    expect(getAcademicYearLabel('2025-01-10')).toBe('Année universitaire 2024–2025');
    expect(getAcademicYearLabel('2025-08-31')).toBe('Année universitaire 2024–2025');
    expect(getAcademicYearLabel('2025-09-01')).toBe('Année universitaire 2025–2026');
  });

  it('getAcademicYearKey produces correct key identifier', () => {
    expect(getAcademicYearKey(null)).toBe('INCONNU');
    expect(getAcademicYearKey('')).toBe('INCONNU');
    expect(getAcademicYearKey('2025-10-01')).toBe('2025-2026');
    expect(getAcademicYearKey('2025-03-01')).toBe('2024-2025');
    expect(getAcademicYearKey('2025-09-15')).toBe('2025-2026');
    expect(getAcademicYearKey('2025-01-10')).toBe('2024-2025');
  });

  it('formatUtcDateTime formats ISO timestamp strictly in UTC', () => {
    expect(formatUtcDateTime(null)).toBe('—');
    expect(formatUtcDateTime(undefined)).toBe('—');
    expect(formatUtcDateTime('2025-10-21T14:30:00Z')).toBe('21 oct. 2025');
    expect(formatUtcDateTime('2025-05-04T08:00:00')).toBe('04 mai 2025');
    expect(formatUtcDateTime('invalid-iso')).toBe('—');
  });

  it('handles unexpected date parsing exceptions via fallback', () => {
    spyOn(Date.prototype, 'getUTCDate').and.throwError('Clock error');
    expect(formatUtcDateTime('2025-01-01T10:00:00Z')).toBe('01 janv. 2025');
  });
});

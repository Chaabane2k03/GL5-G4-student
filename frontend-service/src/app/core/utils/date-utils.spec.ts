import {
  calculateAge,
  formatDateFrLong,
  formatDateFrShort,
  getAcademicYearKey,
  getAcademicYearLabel,
  parseDateString,
} from './date-utils';

describe('DateUtils (Timezone-safe & French Formatting)', () => {
  it('parseDateString should safely parse yyyy-MM-dd without timezone shifting', () => {
    const parts = parseDateString('2025-10-24');
    expect(parts).toEqual({ year: 2025, month: 10, day: 24 });

    const nullParts = parseDateString(null);
    expect(nullParts).toBeNull();

    const invalidParts = parseDateString('invalid-date');
    expect(invalidParts).toBeNull();
  });

  it('formatDateFrShort should format dates with abbreviated French months', () => {
    expect(formatDateFrShort('2025-10-21')).toBe('21 oct. 2025');
    expect(formatDateFrShort('2025-05-15')).toBe('15 mai 2025');
    expect(formatDateFrShort('2025-01-05')).toBe('05 janv. 2025');
    expect(formatDateFrShort(null)).toBe('—');
  });

  it('formatDateFrLong should format dates with full French month names', () => {
    expect(formatDateFrLong('2025-10-24')).toBe('24 octobre 2025');
    expect(formatDateFrLong('2023-05-12')).toBe('12 mai 2023');
    expect(formatDateFrLong(undefined)).toBe('—');
  });

  it('calculateAge should accurately compute student age without UTC discrepancies', () => {
    const refDate = new Date(2025, 9, 24); // 24 octobre 2025
    expect(calculateAge('2003-05-12', refDate)).toBe(22);
    expect(calculateAge('2003-11-15', refDate)).toBe(21); // Pas encore fêté en octobre
    expect(calculateAge('2003-10-24', refDate)).toBe(22); // Anniversaire aujourd'hui
    expect(calculateAge(null)).toBeNull();
  });

  it('getAcademicYearLabel should map September 1st to August 31st', () => {
    // 15 Septembre 2025 -> Année 2025–2026
    expect(getAcademicYearLabel('2025-09-15')).toBe('Année universitaire 2025–2026');
    expect(getAcademicYearKey('2025-09-15')).toBe('2025-2026');

    // 10 Janvier 2025 -> Année 2024–2025
    expect(getAcademicYearLabel('2025-01-10')).toBe('Année universitaire 2024–2025');
    expect(getAcademicYearKey('2025-01-10')).toBe('2024-2025');

    // 31 Août 2025 -> Année 2024–2025
    expect(getAcademicYearLabel('2025-08-31')).toBe('Année universitaire 2024–2025');

    // 1er Septembre 2025 -> Année 2025–2026
    expect(getAcademicYearLabel('2025-09-01')).toBe('Année universitaire 2025–2026');
  });
});

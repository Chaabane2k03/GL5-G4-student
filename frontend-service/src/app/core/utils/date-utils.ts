// Utilitaires de manipulation sécurisée des dates sans décalage de fuseau horaire

const MOIS_FR_COURTS = [
  'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'
];

const MOIS_FR_LONGS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
];

export interface SafeDateParts {
  year: number;
  month: number; // 1-12
  day: number;   // 1-31
}

/**
 * Découpe une chaîne "yyyy-MM-dd" sans passer par `new Date(string)`
 * afin de neutraliser tout décalage dû au fuseau horaire local du navigateur.
 */
export function parseDateString(dateStr: string | null | undefined): SafeDateParts | null {
  if (!dateStr || typeof dateStr !== 'string') {
    return null;
  }
  const cleanStr = dateStr.trim().split('T')[0];
  const parts = cleanStr.split('-');
  if (parts.length < 3) {
    return null;
  }
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);

  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    return null;
  }
  return { year, month, day };
}

/**
 * Formate une date "yyyy-MM-dd" en français abrégé (ex: "21 oct. 2025")
 */
export function formatDateFrShort(dateStr: string | null | undefined): string {
  const parts = parseDateString(dateStr);
  if (!parts) {
    return '—';
  }
  const monthName = MOIS_FR_COURTS[parts.month - 1] ?? '';
  const dayStr = parts.day < 10 ? `0${parts.day}` : `${parts.day}`;
  return `${dayStr} ${monthName} ${parts.year}`;
}

/**
 * Formate une date "yyyy-MM-dd" en français complet (ex: "21 octobre 2025")
 */
export function formatDateFrLong(dateStr: string | null | undefined): string {
  const parts = parseDateString(dateStr);
  if (!parts) {
    return '—';
  }
  const monthName = MOIS_FR_LONGS[parts.month - 1] ?? '';
  return `${parts.day} ${monthName} ${parts.year}`;
}

/**
 * Calcule l'âge d'un étudiant à partir de sa date de naissance "yyyy-MM-dd",
 * sans conversion UTC hasardeuse.
 */
export function calculateAge(dateOfBirthStr: string | null | undefined, referenceDate = new Date()): number | null {
  const parts = parseDateString(dateOfBirthStr);
  if (!parts) {
    return null;
  }
  const refYear = referenceDate.getFullYear();
  const refMonth = referenceDate.getMonth() + 1;
  const refDay = referenceDate.getDate();

  let age = refYear - parts.year;
  if (refMonth < parts.month || (refMonth === parts.month && refDay < parts.day)) {
    age--;
  }
  return age >= 0 ? age : null;
}

/**
 * Calcule l'année académique d'un acte d'inscription.
 * Règle institutionnelle : du 1er septembre au 31 août.
 * Exemple: "2025-09-15" -> "Année universitaire 2025–2026"
 *          "2025-01-10" -> "Année universitaire 2024–2025"
 */
export function getAcademicYearLabel(enrollmentDateStr: string | null | undefined): string {
  const parts = parseDateString(enrollmentDateStr);
  if (!parts) {
    return 'Année indéterminée';
  }
  // Si mois >= 9 (Septembre à Décembre), l'année académique démarre en `year`
  // Sinon (Janvier à Août), l'année académique a démarré en `year - 1`
  const startYear = parts.month >= 9 ? parts.year : parts.year - 1;
  return `Année universitaire ${startYear}–${startYear + 1}`;
}

export function getAcademicYearKey(enrollmentDateStr: string | null | undefined): string {
  const parts = parseDateString(enrollmentDateStr);
  if (!parts) {
    return 'INCONNU';
  }
  const startYear = parts.month >= 9 ? parts.year : parts.year - 1;
  return `${startYear}-${startYear + 1}`;
}

/**
 * Les champs createdAt/updatedAt sont renvoyés par Spring Boot en LocalDateTime sans "Z".
 * Cette fonction les traite rigoureusement comme du temps UTC.
 */
export function formatUtcDateTime(dateIsoStr: string | null | undefined): string {
  if (!dateIsoStr) {
    return '—';
  }
  // S'assurer de la présence du suffixe 'Z' pour que le navigateur sache que c'est de l'UTC
  const normalizedIso = dateIsoStr.endsWith('Z') ? dateIsoStr : `${dateIsoStr}Z`;
  try {
    const d = new Date(normalizedIso);
    if (isNaN(d.getTime())) {
      return formatDateFrShort(dateIsoStr);
    }
    const day = d.getUTCDate();
    const month = MOIS_FR_COURTS[d.getUTCMonth()];
    const year = d.getUTCFullYear();
    const dayStr = day < 10 ? `0${day}` : `${day}`;
    return `${dayStr} ${month} ${year}`;
  } catch {
    return formatDateFrShort(dateIsoStr);
  }
}

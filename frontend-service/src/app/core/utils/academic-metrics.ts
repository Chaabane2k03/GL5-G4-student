import { Course } from '../../domain/course.model';
import { Enrollment } from '../../domain/enrollment.model';
import { Student } from '../../domain/student.model';

export interface DecanatAlert {
  id: string;
  type: 'COURSES_NO_ENROLLMENT' | 'STUDENTS_NO_ENROLLMENT' | 'ARCHIVED_WITH_ACTIVE';
  title: string;
  count: number;
  tags: string[];
  severity: 'warning' | 'error' | 'info';
  route: string;
  queryParams?: Record<string, string>;
}

export interface StudentAcademicSummary {
  validatedCredits: number;
  inProgressCredits: number;
  weightedAverage: number | null;
  mention: string | null;
}

/**
 * FORMULE : Crédits validés
 * Somme des crédits des cours pour lesquels l'étudiant a une inscription au statut "COMPLETED".
 */
export function calculateValidatedCredits(
  enrollments: Enrollment[],
  coursesMap: Map<number, Course>,
): number {
  return enrollments
    .filter(e => e.status === 'COMPLETED')
    .reduce((sum, e) => {
      const course = coursesMap.get(e.courseId);
      return sum + (course ? course.credits : 0);
    }, 0);
}

/**
 * FORMULE : Crédits en cours
 * Somme des crédits des cours pour lesquels l'étudiant a une inscription au statut "ACTIVE".
 */
export function calculateInProgressCredits(
  enrollments: Enrollment[],
  coursesMap: Map<number, Course>,
): number {
  return enrollments
    .filter(e => e.status === 'ACTIVE')
    .reduce((sum, e) => {
      const course = coursesMap.get(e.courseId);
      return sum + (course ? course.credits : 0);
    }, 0);
}

/**
 * FORMULE : Moyenne générale pondérée
 * Moyenne = ∑(note × crédits) / ∑(crédits)
 * Calculée sur les inscriptions ayant une note non nulle (grade !== null).
 * Échelle standard de notation universitaire : 0 à 20.
 * Retourne null si aucune note n'a encore été attribuée.
 */
export function calculateWeightedAverage(
  enrollments: Enrollment[],
  coursesMap: Map<number, Course>,
): number | null {
  const gradedEnrollments = enrollments.filter(e => e.grade !== null && typeof e.grade === 'number');

  if (gradedEnrollments.length === 0) {
    return null;
  }

  let totalPoints = 0;
  let totalCredits = 0;

  for (const e of gradedEnrollments) {
    const course = coursesMap.get(e.courseId);
    const credits = course ? course.credits : 1;
    totalPoints += (e.grade as number) * credits;
    totalCredits += credits;
  }

  if (totalCredits === 0) {
    return null;
  }

  const average = totalPoints / totalCredits;
  // Arrondi à une décimale pour l'affichage canonique
  return Math.round(average * 10) / 10;
}

/**
 * Mention académique selon l'échelle LMD française/tunisienne
 */
export function getMentionLabel(average: number | null): string | null {
  if (average === null) return null;
  if (average >= 16) return 'Très Bien';
  if (average >= 14) return 'Bien';
  if (average >= 12) return 'Assez Bien';
  if (average >= 10) return 'Passable';
  return 'Ajourné';
}

/**
 * Génère le résumé académique complet d'un étudiant
 */
export function getStudentAcademicSummary(
  enrollments: Enrollment[],
  coursesMap: Map<number, Course>,
): StudentAcademicSummary {
  const validatedCredits = calculateValidatedCredits(enrollments, coursesMap);
  const inProgressCredits = calculateInProgressCredits(enrollments, coursesMap);
  const weightedAverage = calculateWeightedAverage(enrollments, coursesMap);
  const mention = getMentionLabel(weightedAverage);

  return {
    validatedCredits,
    inProgressCredits,
    weightedAverage,
    mention,
  };
}

/**
 * FORMULE : Alertes du Tableau de bord
 * 1. Cours actifs n'ayant aucune inscription enregistrée
 * 2. Étudiants réguliers inscrits à aucun enseignement
 * 3. Cours archivés conservant des inscriptions toujours "ACTIVE"
 */
export function calculateDashboardAlerts(
  courses: Course[],
  students: Student[],
  enrollments: Enrollment[],
  departmentsMap?: Map<number, string>,
): DecanatAlert[] {
  const alerts: DecanatAlert[] = [];

  // 1. Cours actifs sans aucune inscription
  const coursesWithEnrollments = new Set(enrollments.map(e => e.courseId));
  const activeCoursesWithoutEnrollment = courses.filter(
    c => c.status === 'ACTIVE' && !coursesWithEnrollments.has(c.id),
  );

  if (activeCoursesWithoutEnrollment.length > 0) {
    const deptNames = Array.from(
      new Set(
        activeCoursesWithoutEnrollment
          .map(c => departmentsMap?.get(c.departmentId) || `Département n°${c.departmentId}`)
      )
    ).slice(0, 2);

    alerts.push({
      id: 'courses-empty',
      type: 'COURSES_NO_ENROLLMENT',
      title: `${activeCoursesWithoutEnrollment.length} cours n'ont aucune inscription`,
      count: activeCoursesWithoutEnrollment.length,
      tags: deptNames,
      severity: 'warning',
      route: '/cours',
    });
  }

  // 2. Étudiants sans aucune inscription
  const studentsWithEnrollments = new Set(enrollments.map(e => e.studentId));
  const studentsWithoutEnrollment = students.filter(s => !studentsWithEnrollments.has(s.id));

  if (studentsWithoutEnrollment.length > 0) {
    alerts.push({
      id: 'students-empty',
      type: 'STUDENTS_NO_ENROLLMENT',
      title: `${studentsWithoutEnrollment.length} étudiants ne sont inscrits à aucun cours`,
      count: studentsWithoutEnrollment.length,
      tags: ['Inscription requise'],
      severity: 'warning',
      route: '/etudiants',
    });
  }

  // 3. Cours archivés avec inscriptions toujours actives
  const archivedCourseIds = new Set(courses.filter(c => c.status === 'ARCHIVED').map(c => c.id));
  const activeEnrollmentsOnArchivedCourses = enrollments.filter(
    e => e.status === 'ACTIVE' && archivedCourseIds.has(e.courseId),
  );
  const impactedArchivedCourseCount = new Set(
    activeEnrollmentsOnArchivedCourses.map(e => e.courseId),
  ).size;

  if (impactedArchivedCourseCount > 0) {
    alerts.push({
      id: 'archived-active',
      type: 'ARCHIVED_WITH_ACTIVE',
      title: `${impactedArchivedCourseCount} cours archivés ont encore des inscriptions en cours`,
      count: impactedArchivedCourseCount,
      tags: ['Attention requise'],
      severity: 'error',
      route: '/cours',
    });
  }

  return alerts;
}

/**
 * Attribution de teinte visuelle pour un département (0 à 6)
 * Couleurs douces extraites des maquettes : vert forêt, ocre, bleu ardoise, terracotta, olive, prune, sable.
 */
export function getDepartmentColorIndex(departmentId: number): number {
  if (Number.isNaN(departmentId) || departmentId < 0) return 0;
  return Math.abs(departmentId) % 7;
}

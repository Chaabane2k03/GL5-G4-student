export interface Student {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string; // "yyyy-MM-dd"
  address: string;
  departmentId: number;
}

export interface StudentCreateRequest {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  address: string;
  departmentId: number;
}

export interface StudentUpdateRequest {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  address: string;
  departmentId: number;
}

/**
 * Génération déterministe du matricule étudiant côté client.
 * Évite d'inventer un champ backend non persisté tout en respectant l'affichage des maquettes.
 */
export function getStudentMatricule(student: Student): string {
  const year = student.dateOfBirth ? student.dateOfBirth.split('-')[0] : '2024';
  const paddedId = student.id.toString().padStart(4, '0');
  return `MAT-${year}-${paddedId}`;
}

export function getStudentFullName(student: Student): string {
  return `${student.firstName} ${student.lastName}`.trim();
}

export function getStudentInitials(student: Student): string {
  const f = student.firstName.charAt(0).toUpperCase();
  const l = student.lastName.charAt(0).toUpperCase();
  return `${f}${l}` || 'ET';
}

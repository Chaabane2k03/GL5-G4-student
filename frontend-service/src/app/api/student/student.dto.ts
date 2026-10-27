export interface StudentDto {
  idStudent: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string; // "yyyy-MM-dd"
  address: string;
  departmentId: number;
}

export interface StudentCreateDto {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  address: string;
  departmentId: number;
}

export interface StudentUpdateDto {
  idStudent: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  address: string;
  departmentId: number;
}

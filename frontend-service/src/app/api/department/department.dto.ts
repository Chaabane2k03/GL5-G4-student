export interface DepartmentDto {
  idDepartment: number;
  name: string;
  location: string;
  phone: string;
  head: string;
}

export interface DepartmentRequestDto {
  name: string;
  location: string;
  phone: string;
  head: string;
}

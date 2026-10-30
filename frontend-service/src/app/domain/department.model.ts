export interface Department {
  id: number;
  name: string;
  location: string;
  phone: string;
  head: string;
}

export interface DepartmentCreateRequest {
  name: string;
  location: string;
  phone: string;
  head: string;
}

export interface DepartmentUpdateRequest {
  name: string;
  location: string;
  phone: string;
  head: string;
}

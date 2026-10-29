export type CourseStatus = 'ACTIVE' | 'ARCHIVED';

export type CourseSortField = 'code' | 'title' | 'credits' | 'createdAt' | 'updatedAt';
export type SortDirection = 'asc' | 'desc';

export interface Course {
  id: number;
  code: string;
  title: string;
  description: string | null;
  credits: number;
  departmentId: number;
  status: CourseStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CourseRequest {
  code: string;
  title: string;
  description: string | null;
  credits: number;
  departmentId: number;
}

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

export interface CourseFilterParams {
  departmentId?: number | null;
  status?: CourseStatus | null;
  page?: number;
  size?: number;
  sort?: string; // ex: "code,asc"
}

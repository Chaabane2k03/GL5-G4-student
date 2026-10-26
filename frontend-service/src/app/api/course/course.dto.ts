import { CourseStatus } from '../../domain/course.model';

export interface CourseResponseDto {
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

export interface CourseRequestDto {
  code: string;
  title: string;
  description: string | null;
  credits: number;
  departmentId: number;
}

export interface PageResponseDto<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

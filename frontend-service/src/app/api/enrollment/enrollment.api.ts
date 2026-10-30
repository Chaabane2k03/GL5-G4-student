import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ConfigService } from '../../core/config/runtime-config';
import {
  Enrollment,
  EnrollmentCreateRequest,
  EnrollmentUpdateRequest,
} from '../../domain/enrollment.model';
import { EnrollmentResponseDto } from './enrollment.dto';
import { toEnrollment, toEnrollmentCreateDto, toEnrollmentUpdateDto } from './enrollment.mapper';

@Injectable({
  providedIn: 'root',
})
export class EnrollmentApi {
  private readonly http = inject(HttpClient);
  private readonly configService = inject(ConfigService);

  private get baseUrl(): string {
    return `${this.configService.apiBaseUrl}/enrollment/Enrollment`;
  }

  getAll(): Observable<Enrollment[]> {
    return this.http
      .get<EnrollmentResponseDto[]>(`${this.baseUrl}/getAllEnrollment`)
      .pipe(map(dtos => (dtos || []).map(toEnrollment)));
  }

  getById(id: number): Observable<Enrollment> {
    return this.http
      .get<EnrollmentResponseDto>(`${this.baseUrl}/getEnrollment/${id}`)
      .pipe(map(toEnrollment));
  }

  getByStudentId(studentId: number): Observable<Enrollment[]> {
    return this.http
      .get<EnrollmentResponseDto[]>(`${this.baseUrl}/student/${studentId}`)
      .pipe(map(dtos => (dtos || []).map(toEnrollment)));
  }

  getByCourseId(courseId: number): Observable<Enrollment[]> {
    return this.http
      .get<EnrollmentResponseDto[]>(`${this.baseUrl}/course/${courseId}`)
      .pipe(map(dtos => (dtos || []).map(toEnrollment)));
  }

  create(req: EnrollmentCreateRequest): Observable<number> {
    const body = toEnrollmentCreateDto(req);
    return this.http.post<number>(`${this.baseUrl}/createEnrollment`, body);
  }

  update(req: EnrollmentUpdateRequest): Observable<void> {
    const body = toEnrollmentUpdateDto(req);
    return this.http.put<void>(`${this.baseUrl}/updateEnrollment`, body);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/deleteEnrollment/${id}`);
  }
}

import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ConfigService } from '../../core/config/runtime-config';
import { Student, StudentCreateRequest, StudentUpdateRequest } from '../../domain/student.model';
import { StudentDto } from './student.dto';
import { toStudent, toStudentCreateDto, toStudentUpdateDto } from './student.mapper';

@Injectable({
  providedIn: 'root',
})
export class StudentApi {
  private readonly http = inject(HttpClient);
  private readonly configService = inject(ConfigService);

  private get baseUrl(): string {
    return `${this.configService.apiBaseUrl}/student/students`;
  }

  getAll(): Observable<Student[]> {
    return this.http
      .get<StudentDto[]>(`${this.baseUrl}/getAllStudents`)
      .pipe(map(dtos => (dtos || []).map(toStudent)));
  }

  getById(id: number): Observable<Student> {
    return this.http.get<StudentDto>(`${this.baseUrl}/getStudent/${id}`).pipe(map(toStudent));
  }

  create(req: StudentCreateRequest): Observable<Student> {
    const body = toStudentCreateDto(req);
    return this.http.post<StudentDto>(`${this.baseUrl}/createStudent`, body).pipe(map(toStudent));
  }

  update(req: StudentUpdateRequest): Observable<Student> {
    const body = toStudentUpdateDto(req);
    return this.http.put<StudentDto>(`${this.baseUrl}/updateStudent`, body).pipe(map(toStudent));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/deleteStudent/${id}`);
  }
}

import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ConfigService } from '../../core/config/runtime-config';
import {
  Department,
  DepartmentCreateRequest,
  DepartmentUpdateRequest,
} from '../../domain/department.model';
import { DepartmentDto } from './department.dto';
import { toDepartment, toDepartmentRequestDto } from './department.mapper';

@Injectable({
  providedIn: 'root',
})
export class DepartmentApi {
  private readonly http = inject(HttpClient);
  private readonly configService = inject(ConfigService);

  private get baseUrl(): string {
    return `${this.configService.apiBaseUrl}/department/api/departments`;
  }

  getAll(): Observable<Department[]> {
    return this.http
      .get<DepartmentDto[]>(this.baseUrl)
      .pipe(map(dtos => (dtos || []).map(toDepartment)));
  }

  getById(id: number): Observable<Department> {
    return this.http.get<DepartmentDto>(`${this.baseUrl}/${id}`).pipe(map(toDepartment));
  }

  create(req: DepartmentCreateRequest): Observable<Department> {
    const body = toDepartmentRequestDto(req);
    return this.http.post<DepartmentDto>(this.baseUrl, body).pipe(map(toDepartment));
  }

  update(id: number, req: DepartmentUpdateRequest): Observable<Department> {
    const body = toDepartmentRequestDto(req);
    return this.http.put<DepartmentDto>(`${this.baseUrl}/${id}`, body).pipe(map(toDepartment));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}

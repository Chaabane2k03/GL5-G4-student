import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { expand, map, Observable, reduce } from 'rxjs';
import { ConfigService } from '../../core/config/runtime-config';
import { Course, CourseFilterParams, CourseRequest, PageResponse } from '../../domain/course.model';
import { CourseResponseDto, PageResponseDto } from './course.dto';
import { toCourse, toCoursePageResponse, toCourseRequestDto } from './course.mapper';

@Injectable({
  providedIn: 'root',
})
export class CourseApi {
  private readonly http = inject(HttpClient);
  private readonly configService = inject(ConfigService);

  private get baseUrl(): string {
    return `${this.configService.apiBaseUrl}/course/api/courses`;
  }

  getPage(params: CourseFilterParams = {}): Observable<PageResponse<Course>> {
    let httpParams = new HttpParams()
      .set('page', (params.page ?? 0).toString())
      .set('size', (params.size ?? 20).toString());

    if (params.sort) {
      httpParams = httpParams.set('sort', params.sort);
    }
    if (params.departmentId !== null && params.departmentId !== undefined) {
      httpParams = httpParams.set('departmentId', params.departmentId.toString());
    }
    if (params.status) {
      httpParams = httpParams.set('status', params.status);
    }

    return this.http
      .get<PageResponseDto<CourseResponseDto>>(this.baseUrl, { params: httpParams })
      .pipe(map(toCoursePageResponse));
  }

  getById(id: number): Observable<Course> {
    return this.http.get<CourseResponseDto>(`${this.baseUrl}/${id}`).pipe(map(toCourse));
  }

  create(req: CourseRequest): Observable<Course> {
    const body = toCourseRequestDto(req);
    return this.http.post<CourseResponseDto>(this.baseUrl, body).pipe(map(toCourse));
  }

  update(id: number, req: CourseRequest): Observable<Course> {
    const body = toCourseRequestDto(req);
    return this.http.put<CourseResponseDto>(`${this.baseUrl}/${id}`, body).pipe(map(toCourse));
  }

  archive(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  activate(id: number): Observable<Course> {
    return this.http
      .patch<CourseResponseDto>(`${this.baseUrl}/${id}/activate`, {})
      .pipe(map(toCourse));
  }

  /**
   * Charge l'intégralité du catalogue des cours en bouclant avec size=100 jusqu'à `last: true`.
   * Requis pour le tableau de bord, la recherche globale et le sélecteur d'inscriptions.
   */
  getAllCatalog(): Observable<Course[]> {
    return this.getPage({ page: 0, size: 100, sort: 'code,asc' }).pipe(
      expand(page => {
        if (page.last || page.content.length === 0) {
          return [];
        }
        return this.getPage({ page: page.page + 1, size: 100, sort: 'code,asc' });
      }),
      reduce((acc: Course[], page) => acc.concat(page.content), []),
    );
  }
}

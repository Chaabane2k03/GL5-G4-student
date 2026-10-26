import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { ConfigService } from '../config/runtime-config';
import { authInterceptor } from './auth.interceptor';
import { errorInterceptor, ErrorNotificationService } from './error.interceptor';
import { AppError } from '../error/app-error';

describe('HTTP Interceptors (Auth & Error Mapping)', () => {
  let httpClient: HttpClient;
  let httpTestingController: HttpTestingController;
  let authServiceMock: { token: () => string | null; updateToken: () => Promise<string | null>; isSessionExpired: { set: (v: boolean) => void } };
  let routerMock: { navigate: jasmine.Spy };
  let errorNotificationMock: { showServiceUnavailable: jasmine.Spy };

  const flushInterceptorPromises = () => new Promise<void>(resolve => setTimeout(resolve, 0));

  const expectFailure = async (request: ReturnType<HttpClient['get']>): Promise<AppError> => {
    try {
      await firstValueFrom(request);
      throw new Error('La requête aurait dû échouer.');
    } catch (error) {
      return error as AppError;
    }
  };

  beforeEach(() => {
    authServiceMock = {
      token: () => 'mock-jwt-token-123',
      updateToken: () => Promise.resolve('mock-jwt-token-123'),
      isSessionExpired: { set: jasmine.createSpy('set') },
    };

    routerMock = {
      navigate: jasmine.createSpy('navigate'),
    };

    errorNotificationMock = {
      showServiceUnavailable: jasmine.createSpy('showServiceUnavailable'),
    };

    const configServiceMock = {
      apiBaseUrl: 'http://localhost:8072',
      keycloak: {
        url: 'http://localhost:8080',
        realm: 'gl5',
        clientId: 'cursus-frontend',
      },
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authServiceMock },
        { provide: Router, useValue: routerMock },
        { provide: ConfigService, useValue: configServiceMock },
        { provide: ErrorNotificationService, useValue: errorNotificationMock },
      ],
    });

    httpClient = TestBed.inject(HttpClient);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('authInterceptor should attach Authorization: Bearer only to Gateway requests', async () => {
    // 1. Requête dirigée vers la passerelle
    const gatewayResponse = firstValueFrom(httpClient.get('http://localhost:8072/department/api/departments'));
    await flushInterceptorPromises();

    const reqGateway = httpTestingController.expectOne('http://localhost:8072/department/api/departments');
    expect(reqGateway.request.headers.get('Authorization')).toBe('Bearer mock-jwt-token-123');
    reqGateway.flush([]);
    await gatewayResponse;

    // 2. Requête vers un domaine externe (ex: /config.json)
    const externalResponse = firstValueFrom(httpClient.get('/config.json'));

    const reqExternal = httpTestingController.expectOne('/config.json');
    expect(reqExternal.request.headers.has('Authorization')).toBeFalse();
    reqExternal.flush({});
    await externalResponse;
  });

  it('errorInterceptor should map 401 and trigger session expired', async () => {
    const failure = expectFailure(httpClient.get('http://localhost:8072/course/api/courses'));
    await flushInterceptorPromises();

    const req = httpTestingController.expectOne('http://localhost:8072/course/api/courses');
    req.flush({ message: 'Non autorisé' }, { status: 401, statusText: 'Unauthorized' });

    const error = await failure;
    expect(error.status).toBe(401);
    expect(authServiceMock.isSessionExpired.set).toHaveBeenCalledWith(true);
  });

  it('errorInterceptor should map 403 and navigate to /403', async () => {
    const failure = expectFailure(httpClient.get('http://localhost:8072/student/students/getAllStudents'));
    await flushInterceptorPromises();

    const req = httpTestingController.expectOne('http://localhost:8072/student/students/getAllStudents');
    req.flush({}, { status: 403, statusText: 'Forbidden' });

    const error = await failure;
    expect(error.status).toBe(403);
    expect(routerMock.navigate).toHaveBeenCalledWith(['/403']);
  });

  it('errorInterceptor should map 503 and trigger service unavailable notice', async () => {
    const failure = expectFailure(httpClient.get('http://localhost:8072/enrollment/Enrollment/getAllEnrollment'));
    await flushInterceptorPromises();

    const req = httpTestingController.expectOne('http://localhost:8072/enrollment/Enrollment/getAllEnrollment');
    req.flush({}, { status: 503, statusText: 'Service Unavailable' });

    const error = await failure;
    expect(error.status).toBe(503);
    expect(errorNotificationMock.showServiceUnavailable).toHaveBeenCalledWith('Inscriptions');
    expect(error.message).toContain('Inscriptions');
  });

  it('errorInterceptor should map 429 with specific rate limit message', async () => {
    const failure = expectFailure(httpClient.get('http://localhost:8072/department/api/departments'));
    await flushInterceptorPromises();

    const req = httpTestingController.expectOne('http://localhost:8072/department/api/departments');
    req.flush({}, { status: 429, statusText: 'Too Many Requests' });

    const error = await failure;
    expect(error.status).toBe(429);
    expect(error.message).toBe('Trop de requêtes, patientez quelques secondes.');
  });
});

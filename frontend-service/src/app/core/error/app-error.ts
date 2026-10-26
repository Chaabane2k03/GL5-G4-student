// Modèle d'erreur normalisé pour tous les microservices Spring Boot

export interface FieldError {
  field: string;
  message: string;
}

export interface AppError {
  status: number;
  message: string;
  serviceName?: string;
  fieldErrors?: FieldError[];
  timestamp?: string;
  path?: string;
}

export function isAppError(err: unknown): err is AppError {
  return typeof err === 'object' && err !== null && 'status' in err && 'message' in err && !('error' in err);
}

export function normalizeHttpError(error: unknown, serviceName?: string): AppError {
  if (isAppError(error)) {
    return error;
  }

  const errObj = error as Record<string, unknown> | null;
  const status = typeof errObj?.['status'] === 'number' ? (errObj['status'] as number) : 0;

  // Extraction du corps renvoyé par Spring Boot
  const responseBody = errObj?.['error'] as Record<string, unknown> | undefined;

  let message = 'Une erreur inattendue est survenue.';
  let fieldErrors: FieldError[] | undefined = undefined;

  if (responseBody && typeof responseBody === 'object') {
    if (typeof responseBody['message'] === 'string') {
      message = responseBody['message'];
    } else if (typeof responseBody['error'] === 'string') {
      message = responseBody['error'];
    }

    if (Array.isArray(responseBody['fieldErrors'])) {
      fieldErrors = (responseBody['fieldErrors'] as Record<string, unknown>[]).map(fe => ({
        field: String(fe['field'] || ''),
        message: String(fe['message'] || ''),
      }));
    }
  } else if (typeof errObj?.['message'] === 'string') {
    message = errObj['message'];
  }

  // Messages contextualisés selon le code HTTP
  if (status === 0 || status === 503 || status === 504) {
    message = serviceName
      ? `Le service ${serviceName} est temporairement indisponible.`
      : 'Le service est temporairement indisponible.';
  } else if (status === 429) {
    message = 'Trop de requêtes, patientez quelques secondes.';
  } else if (status === 403) {
    message = 'Accès refusé.';
  } else if (status === 404) {
    message = 'La ressource demandée est introuvable.';
  } else if (status === 409) {
    message = message || 'Conflit : cette ressource ou ce code existe déjà.';
  }

  return {
    status,
    message,
    serviceName,
    fieldErrors,
    timestamp: new Date().toISOString(),
  };
}

export type ErrorCode =
  | 'VALIDATION'
  | 'UNAUTHENTICATED'
  | 'DEVICE_NOT_ENROLLED'
  | 'FORBIDDEN'
  | 'LOCKED'
  | 'RATE_LIMITED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'CONFIRM_REQUIRED';

const STATUS: Record<ErrorCode, number> = {
  VALIDATION: 422,
  UNAUTHENTICATED: 401,
  DEVICE_NOT_ENROLLED: 401,
  FORBIDDEN: 403,
  LOCKED: 423,
  RATE_LIMITED: 429,
  NOT_FOUND: 404,
  CONFLICT: 409,
  CONFIRM_REQUIRED: 409,
};

const DEFAULT_MESSAGE: Record<ErrorCode, string> = {
  VALIDATION: 'Revisa los datos ingresados.',
  UNAUTHENTICATED: 'Tu sesión terminó. Vuelve a entrar con tu PIN.',
  DEVICE_NOT_ENROLLED: 'Este dispositivo no está registrado.',
  FORBIDDEN: 'No tienes permiso para hacer esto.',
  LOCKED: 'Demasiados intentos. Espera un momento.',
  RATE_LIMITED: 'Demasiados intentos. Intenta más tarde.',
  NOT_FOUND: 'No encontrado.',
  CONFLICT: 'No se puede completar la acción.',
  CONFIRM_REQUIRED: 'Se necesita confirmación.',
};

export interface ErrorExtra {
  fields?: Record<string, string>;
  retryAfterSec?: number;
  reason?: string;
}

export class ApiError extends Error {
  readonly status: number;
  constructor(
    readonly code: ErrorCode,
    message?: string,
    readonly extra: ErrorExtra = {},
  ) {
    super(message ?? DEFAULT_MESSAGE[code]);
    this.status = STATUS[code];
  }
}

export const notFound = (message?: string) => new ApiError('NOT_FOUND', message);
export const conflict = (reason: string, message?: string) => new ApiError('CONFLICT', message, { reason });
export const confirmRequired = (reason: string, message?: string) =>
  new ApiError('CONFIRM_REQUIRED', message, { reason });

export function toResponse(err: unknown): Response {
  if (err instanceof ApiError) {
    const headers: Record<string, string> = {};
    if (err.extra.retryAfterSec !== undefined) headers['Retry-After'] = String(err.extra.retryAfterSec);
    return Response.json({ error: { code: err.code, message: err.message, ...err.extra } }, { status: err.status, headers });
  }
  console.error(err);
  return Response.json(
    { error: { code: 'INTERNAL', message: 'Ocurrió un error inesperado. Intenta de nuevo.' } },
    { status: 500 },
  );
}

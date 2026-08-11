import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorBody {
  statusCode: number;
  message: string | string[];
  error: string;
  path: string;
  timestamp: string;
}

// same error shape as backend's filter — see ubiqedge_tech_api_design #6.
// No QueryFailedError branch here: ingestion-service talks to MySQL via a
// plain mysql2 pool, not TypeORM, and IngestService already catches/handles
// the one duplicate-key case (idempotent retry) itself before it could
// reach here — see IngestService.
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, message, error } = this.resolve(exception);

    this.logger.error(
      `${request.method} ${request.originalUrl} -> ${status} ${JSON.stringify(message)}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    const body: ErrorBody = {
      statusCode: status,
      message,
      error,
      path: request.originalUrl,
      timestamp: new Date().toISOString(),
    };
    response.status(status).json(body);
  }

  private resolve(exception: unknown): {
    status: number;
    message: string | string[];
    error: string;
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        return { status, message: res, error: exception.name };
      }
      const r = res as { message?: string | string[]; error?: string };
      return {
        status,
        message: r.message ?? exception.message,
        error: r.error ?? exception.name,
      };
    }

    const message = exception instanceof Error ? exception.message : 'Internal server error';
    return { status: HttpStatus.INTERNAL_SERVER_ERROR, message, error: 'Internal Server Error' };
  }
}

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { captureBackendError } from '../monitoring/projecttrakr-ingestion';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  async catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;
    const normalizedResponse =
      exceptionResponse && typeof exceptionResponse === 'object'
        ? (exceptionResponse as Record<string, unknown>)
        : null;
    const responseMessage = normalizedResponse?.message;
    const message =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : Array.isArray(responseMessage)
          ? responseMessage.join(', ')
          : typeof responseMessage === 'string'
            ? responseMessage
            : (exception as Error)?.message || 'Internal server error';
    const error =
      typeof normalizedResponse?.error === 'string'
        ? normalizedResponse.error
        : exception instanceof HttpException
          ? HttpStatus[status]
          : 'Internal Server Error';

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      await captureBackendError(exception, {
        title: `${request.method} ${request.url} failed`,
        metadata: {
          path: request.url,
          method: request.method,
          statusCode: status,
          error,
        },
        dedupeKey: `http:${request.method}:${request.route?.path ?? request.path}:${status}`,
      });
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      error,
      message,
      details: Array.isArray(responseMessage)
        ? responseMessage
        : normalizedResponse?.details ?? null,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}

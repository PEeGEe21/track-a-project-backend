import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
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

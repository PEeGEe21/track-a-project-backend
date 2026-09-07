import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiProperty,
  ApiPropertyOptional,
  ApiUnauthorizedResponse,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiOperation,
} from '@nestjs/swagger';

export class ApiErrorDto {
  @ApiProperty({ example: false })
  success: false;

  @ApiProperty({ example: 400 })
  statusCode: number;

  @ApiProperty({ example: 'Bad Request' })
  error: string;

  @ApiProperty({ example: 'The request is invalid.' })
  message: string;

  @ApiPropertyOptional({
    nullable: true,
    oneOf: [
      { type: 'array', items: { type: 'string' } },
      { type: 'object', additionalProperties: true },
    ],
  })
  details: string[] | Record<string, unknown> | null;

  @ApiProperty({ format: 'date-time', example: '2026-09-04T20:00:00.000Z' })
  timestamp: string;

  @ApiProperty({ example: '/api/auth/login' })
  path: string;
}

export class MessageResponseDto {
  @ApiProperty({ example: true })
  success: boolean | string;

  @ApiProperty()
  message: string;
}

export class PaginationMetaDto {
  @ApiProperty({ minimum: 1 })
  current_page: number;

  @ApiProperty({ minimum: 0 })
  from: number;

  @ApiProperty({ minimum: 0 })
  last_page: number;

  @ApiProperty({ minimum: 1 })
  per_page: number;

  @ApiProperty({ minimum: 0 })
  to: number;

  @ApiProperty({ minimum: 0 })
  total: number;
}

export class ApiObjectResponseDto {
  @ApiPropertyOptional({ example: true })
  success?: boolean | string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  data?: Record<string, unknown>;

  @ApiPropertyOptional()
  message?: string;
}

export class ApiCollectionResponseDto {
  @ApiPropertyOptional({ example: true })
  success?: boolean | string;

  @ApiProperty({ type: 'array', items: { type: 'object' } })
  data: Record<string, unknown>[];

  @ApiPropertyOptional({ type: PaginationMetaDto })
  meta?: PaginationMetaDto;
}

export function ApiStandardErrors(options?: { forbidden?: boolean }) {
  const decorators = [
    ApiBadRequestResponse({ type: ApiErrorDto }),
    ApiUnauthorizedResponse({ type: ApiErrorDto }),
  ];
  if (options?.forbidden) {
    decorators.push(ApiForbiddenResponse({ type: ApiErrorDto }));
  }
  return applyDecorators(...decorators);
}

export function ApiOrganizationHeader(required = true) {
  return ApiHeader({
    name: 'x-organization-id',
    description: 'Active organization UUID.',
    required,
    schema: { type: 'string', format: 'uuid' },
  });
}

export function ApiContractOperation(
  summary: string,
  responseType: new (...args: never[]) => unknown,
  status: 200 | 201 = 200,
) {
  return applyDecorators(
    ApiOperation({ summary }),
    status === 201
      ? ApiCreatedResponse({ type: responseType })
      : ApiOkResponse({ type: responseType }),
  );
}

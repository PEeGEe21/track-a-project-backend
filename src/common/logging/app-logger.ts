import { Logger } from '@nestjs/common';

type LogMeta = Record<string, unknown> | undefined;

function stringifyMeta(meta?: LogMeta): string {
  if (!meta || Object.keys(meta).length === 0) {
    return '';
  }

  return ` ${JSON.stringify(meta)}`;
}

export class AppLogger {
  static log(context: string, message: string, meta?: LogMeta) {
    new Logger(context).log(`${message}${stringifyMeta(meta)}`);
  }

  static warn(context: string, message: string, meta?: LogMeta) {
    new Logger(context).warn(`${message}${stringifyMeta(meta)}`);
  }

  static error(
    context: string,
    message: string,
    meta?: LogMeta,
    trace?: string,
  ) {
    new Logger(context).error(`${message}${stringifyMeta(meta)}`, trace);
  }
}

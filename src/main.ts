import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { config } from './config';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { ClassSerializerInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { AppLogger } from './common/logging/app-logger';

process.env.TZ = 'UTC';
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      whitelist: true,
      forbidNonWhitelisted: false, // Add this
    }),
  );

  const allowedOrigins = config.corsAllowedOrigins;
  const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`Origin ${origin} is not allowed by CORS`), false);
    },
    credentials: true,
    optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
  };
  app.enableCors(corsOptions);
  app.setGlobalPrefix('/api/');

  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  app.useGlobalFilters(new HttpExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Project Tracking Panel')
    .setDescription('TTrack Your Prokect API description')
    .setVersion('1.0')
    .addBearerAuth()
    .setExternalDoc('Trackr Postman Collection', '/api/docs-json')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || config.port;
  await app.listen(port, '0.0.0.0');

  AppLogger.log('Bootstrap', 'Backend started', {
    port,
    environment: config.env,
    allowedOrigins,
    docsUrl: '/api/docs',
    healthUrl: '/api/health',
  });
}
bootstrap();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { config } from './config';
import { ValidationPipe } from '@nestjs/common';
import * as helmet from 'helmet';

import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as csurf from 'csurf';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // app.use(helmet());
  app.useGlobalPipes(new ValidationPipe());

  const corsOptions = {
    origin:
      config.env === 'development'
        ? '*'
        : [
            'https://groups.fitted.ng',
            'https://tailors.fitted.ng',
            'https://admin.fitted.ng',
            'https://staging--outfit-groups.netlify.app',
            /--tailorsportal\.netlify\.app$/,
          ],
    optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
  };
  app.enableCors(corsOptions); // TODO: Setup cors config based on FE's server IPs
  // app.use(csurf());
  app.setGlobalPrefix('/api/');

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Group Orders')
    .setDescription('The Group Orders API description')
    .setVersion('1.0')
    .addBearerAuth()
    .setExternalDoc('Group API & Tailor Postman Collection', '/api/docs-json')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || config.port;
  await app.listen(port);

  console.log(`listening on: http://localhost:${port}`);
}
bootstrap();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { config } from './config';
import { ValidationPipe } from '@nestjs/common';
import * as helmet from 'helmet';
import { ClassSerializerInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as csurf from 'csurf';

process.env.TZ = 'UTC';
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // app.use(helmet());
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

  const corsOptions = {
    origin: config.env === 'development' ? '*' : [],
    optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
  };
  app.enableCors(corsOptions); // TODO: Setup cors config based on FE's server IPs
  // app.use(csurf());
  app.setGlobalPrefix('/api/');

  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  // const seederService = app.get(SeederService);
  // await seederService.seedUserPeers();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Group Orders')
    .setDescription('The Group Orders API description')
    .setVersion('1.0')
    .addBearerAuth()
    .setExternalDoc('Trackr Postman Collection', '/api/docs-json')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || config.port;
  await app.listen(port, '0.0.0.0');

  console.log(`listening on: http://localhost:${port}`);
}
bootstrap();

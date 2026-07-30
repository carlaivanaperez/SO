import "./load-env"; // Debe ir primero: carga el .env antes que el resto.
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { json } from "express";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Guardamos el raw body para validar la firma de los webhooks de WhatsApp.
    rawBody: false,
  });

  app.use(
    json({
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    })
  );

  app.enableCors({ origin: process.env.WEB_ORIGIN?.split(",") ?? "*" });
  app.setGlobalPrefix("api");

  const port = Number(process.env.API_PORT ?? 3001);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API escuchando en http://localhost:${port}/api`);
}

void bootstrap();

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

  // WEB_ORIGIN = dominios permitidos separados por coma; sin valor => todos.
  app.enableCors({
    origin: process.env.WEB_ORIGIN ? process.env.WEB_ORIGIN.split(",") : "*",
  });
  app.setGlobalPrefix("api");

  // PORT lo inyecta el hosting (Render); en local usamos API_PORT o 3001.
  // 0.0.0.0 para que el hosting pueda enrutar el tráfico externo.
  const port = Number(process.env.PORT ?? process.env.API_PORT ?? 3001);
  await app.listen(port, "0.0.0.0");
  // eslint-disable-next-line no-console
  console.log(`API escuchando en el puerto ${port} (prefijo /api)`);
}

void bootstrap();

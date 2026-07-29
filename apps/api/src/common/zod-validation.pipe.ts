import { BadRequestException, PipeTransform } from "@nestjs/common";
import type { ZodSchema } from "zod";

/**
 * Pipe que valida el body/query con un esquema de @ferrestock/shared.
 * Uso: @Body(new ZodValidationPipe(createProductSchema)) dto: CreateProductInput
 */
export class ZodValidationPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: "Datos inválidos",
        issues: result.error.issues,
      });
    }
    return result.data;
  }
}

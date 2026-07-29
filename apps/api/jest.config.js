/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/*.spec.ts"],
  transform: {
    "^.+\\.ts$": ["ts-jest", {}],
  },
  moduleNameMapper: {
    // Los paquetes workspace se consumen como fuente TS. @ferrestock/db solo
    // reexporta @prisma/client (enums + Decimal), así que lo apuntamos directo
    // y evitamos instanciar el PrismaClient singleton en los tests.
    "^@ferrestock/db$": "@prisma/client",
  },
};

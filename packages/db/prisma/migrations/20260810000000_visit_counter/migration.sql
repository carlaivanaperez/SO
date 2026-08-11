-- CreateTable
CREATE TABLE "visit_days" (
    "date" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "visit_days_pkey" PRIMARY KEY ("date")
);


-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "financing_surcharge" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "installments_count" INTEGER;

-- CreateTable
CREATE TABLE "installments" (
    "id" TEXT NOT NULL,
    "sale_id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "installments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_config" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "late_fee_daily_percent" DECIMAL(6,3) NOT NULL DEFAULT 0.3,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "installment_options" (
    "installments" INTEGER NOT NULL,
    "surcharge_percent" DECIMAL(6,2) NOT NULL,

    CONSTRAINT "installment_options_pkey" PRIMARY KEY ("installments")
);

-- CreateIndex
CREATE INDEX "installments_sale_id_idx" ON "installments"("sale_id");

-- CreateIndex
CREATE INDEX "installments_due_date_idx" ON "installments"("due_date");

-- AddForeignKey
ALTER TABLE "installments" ADD CONSTRAINT "installments_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;


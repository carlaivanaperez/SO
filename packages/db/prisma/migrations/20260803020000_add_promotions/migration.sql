-- CreateEnum
CREATE TYPE "PromotionType" AS ENUM ('PERCENT', 'TWO_FOR_ONE');

-- CreateTable
CREATE TABLE "promotions" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "type" "PromotionType" NOT NULL,
    "percent" DECIMAL(5,2),
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "promotions_product_id_idx" ON "promotions"("product_id");

-- AddForeignKey
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;


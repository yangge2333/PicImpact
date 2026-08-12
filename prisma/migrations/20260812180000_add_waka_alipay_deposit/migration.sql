ALTER TABLE "waka_bookings"
  ADD COLUMN "payment_order_no" VARCHAR(80),
  ADD COLUMN "payment_provider" VARCHAR(20),
  ADD COLUMN "payment_amount" INTEGER,
  ADD COLUMN "payment_expires_at" TIMESTAMP(3),
  ADD COLUMN "paid_at" TIMESTAMP(3),
  ADD COLUMN "provider_trade_no" VARCHAR(80);

CREATE INDEX "waka_bookings_payment_order_no_idx" ON "waka_bookings"("payment_order_no");

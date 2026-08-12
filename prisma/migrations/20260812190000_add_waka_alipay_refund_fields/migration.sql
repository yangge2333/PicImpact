ALTER TABLE "waka_bookings"
  ADD COLUMN "refund_request_no" VARCHAR(80),
  ADD COLUMN "refund_amount" INTEGER,
  ADD COLUMN "refund_status" VARCHAR(20),
  ADD COLUMN "refunded_at" TIMESTAMP(3);

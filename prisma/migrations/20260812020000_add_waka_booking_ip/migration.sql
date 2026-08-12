ALTER TABLE "waka_bookings"
ADD COLUMN "ip_address" VARCHAR(64);

CREATE INDEX "waka_bookings_ip_address_created_at_idx"
ON "waka_bookings"("ip_address", "created_at");

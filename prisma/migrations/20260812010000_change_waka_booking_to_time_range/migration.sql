DROP INDEX IF EXISTS "waka_bookings_slot_key_key";
ALTER TABLE "waka_bookings" DROP COLUMN IF EXISTS "slot_key";

UPDATE "waka_booking_schedules"
SET "open_minutes" = 600,
    "close_minutes" = 1260;

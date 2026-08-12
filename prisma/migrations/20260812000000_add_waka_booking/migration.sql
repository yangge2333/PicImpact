CREATE TABLE "waka_booking_settings" (
    "id" VARCHAR(50) NOT NULL,
    "booking_window_days" SMALLINT NOT NULL DEFAULT 90,
    "slot_minutes" SMALLINT NOT NULL DEFAULT 30,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP,

    CONSTRAINT "waka_booking_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "waka_booking_schedules" (
    "id" VARCHAR(50) NOT NULL,
    "settings_id" VARCHAR(50) NOT NULL,
    "weekday" SMALLINT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "open_minutes" SMALLINT NOT NULL,
    "close_minutes" SMALLINT NOT NULL,

    CONSTRAINT "waka_booking_schedules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "waka_bookings" (
    "id" VARCHAR(50) NOT NULL,
    "booking_date" DATE NOT NULL,
    "start_minutes" SMALLINT NOT NULL,
    "end_minutes" SMALLINT NOT NULL,
    "slot_key" VARCHAR(80) NOT NULL,
    "contact_type" VARCHAR(20) NOT NULL,
    "contact_value" VARCHAR(120) NOT NULL,
    "customer_name" VARCHAR(80),
    "note" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "admin_note" TEXT,
    "confirmed_at" TIMESTAMP,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP,

    CONSTRAINT "waka_bookings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "waka_booking_schedules_settings_id_weekday_key"
    ON "waka_booking_schedules"("settings_id", "weekday");
CREATE UNIQUE INDEX "waka_bookings_slot_key_key" ON "waka_bookings"("slot_key");
CREATE INDEX "waka_bookings_booking_date_status_idx"
    ON "waka_bookings"("booking_date", "status");
CREATE INDEX "waka_bookings_contact_type_contact_value_idx"
    ON "waka_bookings"("contact_type", "contact_value");

ALTER TABLE "waka_booking_schedules"
    ADD CONSTRAINT "waka_booking_schedules_settings_id_fkey"
    FOREIGN KEY ("settings_id") REFERENCES "waka_booking_settings"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "waka_booking_settings" ("id", "booking_window_days", "slot_minutes")
VALUES ('waka-booking-default', 90, 30);

INSERT INTO "waka_booking_schedules" ("id", "settings_id", "weekday", "enabled", "open_minutes", "close_minutes")
VALUES
    ('waka-booking-mon', 'waka-booking-default', 1, true, 540, 1080),
    ('waka-booking-tue', 'waka-booking-default', 2, true, 540, 1080),
    ('waka-booking-wed', 'waka-booking-default', 3, true, 540, 1080),
    ('waka-booking-thu', 'waka-booking-default', 4, true, 540, 1080),
    ('waka-booking-fri', 'waka-booking-default', 5, true, 540, 1080),
    ('waka-booking-sat', 'waka-booking-default', 6, true, 540, 1080),
    ('waka-booking-sun', 'waka-booking-default', 7, true, 540, 1080);

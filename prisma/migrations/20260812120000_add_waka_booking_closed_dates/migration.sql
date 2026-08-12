CREATE TABLE "waka_booking_closed_dates" (
    "id" VARCHAR(50) NOT NULL,
    "settings_id" VARCHAR(50) NOT NULL,
    "date" DATE NOT NULL,

    CONSTRAINT "waka_booking_closed_dates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "waka_booking_closed_dates_settings_id_date_key"
    ON "waka_booking_closed_dates"("settings_id", "date");
CREATE INDEX "waka_booking_closed_dates_date_idx"
    ON "waka_booking_closed_dates"("date");

ALTER TABLE "waka_booking_closed_dates"
    ADD CONSTRAINT "waka_booking_closed_dates_settings_id_fkey"
    FOREIGN KEY ("settings_id") REFERENCES "waka_booking_settings"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

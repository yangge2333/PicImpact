CREATE TABLE "waka_booking_studios" (
    "id" VARCHAR(50) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "sort" SMALLINT NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP,
    CONSTRAINT "waka_booking_studios_pkey" PRIMARY KEY ("id")
);

INSERT INTO "waka_booking_studios" ("id", "name", "sort")
VALUES ('waka-studio-white-1', '白棚1', 0);

ALTER TABLE "waka_booking" ADD COLUMN "studio_id" VARCHAR(50);

UPDATE "waka_booking"
SET "studio_id" = 'waka-studio-white-1'
WHERE "studio_id" IS NULL;

ALTER TABLE "waka_booking" ALTER COLUMN "studio_id" SET NOT NULL;

ALTER TABLE "waka_booking"
    ADD CONSTRAINT "waka_booking_studio_id_fkey"
    FOREIGN KEY ("studio_id") REFERENCES "waka_booking_studios"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "waka_booking_studio_id_booking_date_status_idx"
    ON "waka_booking"("studio_id", "booking_date", "status");

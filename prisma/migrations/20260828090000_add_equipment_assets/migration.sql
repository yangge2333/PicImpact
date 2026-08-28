CREATE TABLE "equipment_asset_categories" (
  "id" VARCHAR(50) NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "sort" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP,
  CONSTRAINT "equipment_asset_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "equipment_asset_categories_name_key"
  ON "equipment_asset_categories"("name");

CREATE INDEX "equipment_asset_categories_sort_created_at_idx"
  ON "equipment_asset_categories"("sort", "created_at");

CREATE TABLE "equipment_assets" (
  "id" VARCHAR(50) NOT NULL,
  "asset_number" VARCHAR(100) NOT NULL,
  "name" VARCHAR(200) NOT NULL,
  "category_id" VARCHAR(50) NOT NULL,
  "brand" VARCHAR(100),
  "model" VARCHAR(100),
  "serial_number" VARCHAR(100),
  "status" VARCHAR(30) NOT NULL DEFAULT 'available',
  "purchase_date" DATE,
  "purchase_price" DECIMAL(12, 2),
  "storage_location" VARCHAR(200),
  "custodian" VARCHAR(100),
  "notes" TEXT,
  "image_urls" JSONB NOT NULL DEFAULT '[]',
  "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP,
  CONSTRAINT "equipment_assets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "equipment_assets_category_id_fkey"
    FOREIGN KEY ("category_id") REFERENCES "equipment_asset_categories"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "equipment_assets_status_check"
    CHECK ("status" IN ('available', 'in_use', 'maintenance', 'retired'))
);

CREATE UNIQUE INDEX "equipment_assets_asset_number_key"
  ON "equipment_assets"("asset_number");

CREATE INDEX "equipment_assets_category_id_status_idx"
  ON "equipment_assets"("category_id", "status");

CREATE INDEX "equipment_assets_created_at_idx"
  ON "equipment_assets"("created_at");

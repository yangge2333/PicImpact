ALTER TABLE "equipment_assets"
  ADD COLUMN "sort" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "equipment_assets_category_id_sort_idx"
  ON "equipment_assets"("category_id", "sort");

CREATE TABLE "visit_logs" (
    "id" VARCHAR(50) NOT NULL,
    "ip" VARCHAR(100),
    "path" TEXT NOT NULL,
    "user_agent" TEXT,
    "referer" TEXT,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "visit_logs_created_at_idx" ON "visit_logs"("created_at");
CREATE INDEX "visit_logs_ip_idx" ON "visit_logs"("ip");

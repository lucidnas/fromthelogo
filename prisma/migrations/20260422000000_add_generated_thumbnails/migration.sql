-- CreateTable
CREATE TABLE IF NOT EXISTS "GeneratedThumbnail" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeneratedThumbnail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "GeneratedThumbnail_slug_format_idx" ON "GeneratedThumbnail"("slug", "format");

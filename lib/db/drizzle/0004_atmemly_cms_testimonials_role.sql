-- Task #60 — extended testimonial public-content fields.
-- Adds role/company/location split + bilingual quote pair (Ar/En). Legacy
-- `body`/`author_title` columns are preserved for back-compat.
ALTER TABLE "testimonials" ADD COLUMN IF NOT EXISTS "role" text;
ALTER TABLE "testimonials" ADD COLUMN IF NOT EXISTS "company" text;
ALTER TABLE "testimonials" ADD COLUMN IF NOT EXISTS "location" text;
ALTER TABLE "testimonials" ADD COLUMN IF NOT EXISTS "quote_ar" text;
ALTER TABLE "testimonials" ADD COLUMN IF NOT EXISTS "quote_en" text;

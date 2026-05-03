-- Task #60 — ATMEMLY CMS: complete schema for admin-managed public content.
-- Adds new tables for homepage, navigation, footer, SEO, localization,
-- and category management; extends existing CMS tables with status,
-- soft-delete, and category FK columns.

CREATE TABLE IF NOT EXISTS "cms_homepage" (
  "id" serial PRIMARY KEY,
  "data" jsonb NOT NULL,
  "updated_by_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "navigation_items" (
  "id" serial PRIMARY KEY,
  "location" text NOT NULL,
  "parent_id" integer,
  "label_ar" text NOT NULL,
  "label_en" text NOT NULL,
  "href" text NOT NULL,
  "sort_order" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "navigation_items_location_idx" ON "navigation_items" ("location", "sort_order");

CREATE TABLE IF NOT EXISTS "footer_settings" (
  "id" serial PRIMARY KEY,
  "description_ar" text NOT NULL DEFAULT '',
  "description_en" text NOT NULL DEFAULT '',
  "contact_email" text NOT NULL DEFAULT '',
  "contact_phone" text NOT NULL DEFAULT '',
  "whatsapp" text NOT NULL DEFAULT '',
  "address_ar" text NOT NULL DEFAULT '',
  "address_en" text NOT NULL DEFAULT '',
  "copyright_ar" text NOT NULL DEFAULT '',
  "copyright_en" text NOT NULL DEFAULT '',
  "social_links" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "updated_by_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "footer_link_groups" (
  "id" serial PRIMARY KEY,
  "title_ar" text NOT NULL,
  "title_en" text NOT NULL,
  "sort_order" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "footer_groups_sort_idx" ON "footer_link_groups" ("sort_order");

CREATE TABLE IF NOT EXISTS "footer_links" (
  "id" serial PRIMARY KEY,
  "group_id" integer NOT NULL REFERENCES "footer_link_groups"("id") ON DELETE CASCADE,
  "label_ar" text NOT NULL,
  "label_en" text NOT NULL,
  "href" text NOT NULL,
  "sort_order" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "footer_links_group_idx" ON "footer_links" ("group_id", "sort_order");

CREATE TABLE IF NOT EXISTS "seo_settings" (
  "id" serial PRIMARY KEY,
  "site_title_ar" text NOT NULL DEFAULT '',
  "site_title_en" text NOT NULL DEFAULT '',
  "site_description_ar" text NOT NULL DEFAULT '',
  "site_description_en" text NOT NULL DEFAULT '',
  "og_image_url" text,
  "twitter_handle" text,
  "default_locale" text NOT NULL DEFAULT 'ar',
  "updated_by_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "localization_strings" (
  "id" serial PRIMARY KEY,
  "key" text NOT NULL,
  "locale" text NOT NULL,
  "namespace" text NOT NULL DEFAULT 'common',
  "value" text NOT NULL,
  "is_missing" boolean NOT NULL DEFAULT false,
  "updated_by_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "localization_strings_key_locale_uq" UNIQUE ("key", "locale")
);

CREATE TABLE IF NOT EXISTS "blog_categories" (
  "id" serial PRIMARY KEY,
  "slug" text NOT NULL,
  "name_ar" text NOT NULL,
  "name_en" text NOT NULL,
  "sort_order" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "blog_categories_slug_uq" UNIQUE ("slug")
);

CREATE TABLE IF NOT EXISTS "faq_categories" (
  "id" serial PRIMARY KEY,
  "slug" text NOT NULL,
  "name_ar" text NOT NULL,
  "name_en" text NOT NULL,
  "sort_order" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "faq_categories_slug_uq" UNIQUE ("slug")
);

-- Extend existing CMS tables.
ALTER TABLE "cms_pages" ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'draft';
ALTER TABLE "cms_pages" ADD COLUMN IF NOT EXISTS "published_at" timestamp with time zone;

ALTER TABLE "blog_posts" ADD COLUMN IF NOT EXISTS "category_id" integer REFERENCES "blog_categories"("id") ON DELETE SET NULL;
ALTER TABLE "blog_posts" ADD COLUMN IF NOT EXISTS "is_featured" boolean NOT NULL DEFAULT false;
ALTER TABLE "blog_posts" ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'draft';
ALTER TABLE "blog_posts" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;

ALTER TABLE "attachments" ADD COLUMN IF NOT EXISTS "alt_ar" text;
ALTER TABLE "attachments" ADD COLUMN IF NOT EXISTS "alt_en" text;
ALTER TABLE "attachments" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
CREATE INDEX IF NOT EXISTS "attachments_deleted_idx" ON "attachments" ("deleted_at");

ALTER TABLE "faq_items" ADD COLUMN IF NOT EXISTS "category_id" integer REFERENCES "faq_categories"("id") ON DELETE SET NULL;

ALTER TABLE "testimonials" ADD COLUMN IF NOT EXISTS "is_active" boolean NOT NULL DEFAULT true;

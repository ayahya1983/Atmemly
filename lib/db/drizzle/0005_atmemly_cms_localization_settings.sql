CREATE TABLE IF NOT EXISTS "localization_settings" (
  "id" serial PRIMARY KEY NOT NULL,
  "default_locale" text DEFAULT 'ar' NOT NULL,
  "enabled_locales" jsonb DEFAULT '["ar","en"]'::jsonb NOT NULL,
  "rtl_locales" jsonb DEFAULT '["ar"]'::jsonb NOT NULL,
  "fallback_locale" text DEFAULT 'en' NOT NULL,
  "is_rtl_by_default" boolean DEFAULT true NOT NULL,
  "updated_by_id" integer,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

INSERT INTO "localization_settings" ("id") VALUES (1) ON CONFLICT DO NOTHING;

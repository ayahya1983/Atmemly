-- Add category fallback SEO columns to blog_categories and faq_categories.
ALTER TABLE "blog_categories" ADD COLUMN IF NOT EXISTS "seo_title_ar" text;--> statement-breakpoint
ALTER TABLE "blog_categories" ADD COLUMN IF NOT EXISTS "seo_title_en" text;--> statement-breakpoint
ALTER TABLE "blog_categories" ADD COLUMN IF NOT EXISTS "seo_description_ar" text;--> statement-breakpoint
ALTER TABLE "blog_categories" ADD COLUMN IF NOT EXISTS "seo_description_en" text;--> statement-breakpoint
ALTER TABLE "blog_categories" ADD COLUMN IF NOT EXISTS "seo_image_url" text;--> statement-breakpoint
ALTER TABLE "faq_categories" ADD COLUMN IF NOT EXISTS "seo_title_ar" text;--> statement-breakpoint
ALTER TABLE "faq_categories" ADD COLUMN IF NOT EXISTS "seo_title_en" text;--> statement-breakpoint
ALTER TABLE "faq_categories" ADD COLUMN IF NOT EXISTS "seo_description_ar" text;--> statement-breakpoint
ALTER TABLE "faq_categories" ADD COLUMN IF NOT EXISTS "seo_description_en" text;--> statement-breakpoint
ALTER TABLE "faq_categories" ADD COLUMN IF NOT EXISTS "seo_image_url" text;

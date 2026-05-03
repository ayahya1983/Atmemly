import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const blogPostsTable = pgTable(
  "blog_posts",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    locale: text("locale").notNull(),
    title: text("title").notNull(),
    excerpt: text("excerpt").notNull().default(""),
    body: text("body").notNull().default(""),
    coverUrl: text("cover_url"),
    category: text("category"),
    // FK to blog_categories.id (kept nullable for back-compat with `category` text).
    categoryId: integer("category_id"),
    tags: text("tags").array().notNull().default([]),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    isPublished: boolean("is_published").notNull().default(false),
    isFeatured: boolean("is_featured").notNull().default(false),
    status: text("status").notNull().default("draft"), // draft | published | archived
    publishedAt: timestamp("published_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    authorId: integer("author_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    slugLocaleUq: uniqueIndex("blog_posts_slug_locale_uq").on(t.slug, t.locale),
    publishedIdx: index("blog_posts_published_idx").on(t.isPublished, t.publishedAt),
  }),
);

export type BlogPost = typeof blogPostsTable.$inferSelect;

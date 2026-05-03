CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"full_name" text NOT NULL,
	"role" text NOT NULL,
	"admin_role" text,
	"status" text DEFAULT 'active' NOT NULL,
	"avatar_url" text,
	"email_verified_at" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"last_login_ip" text,
	"last_login_ua" text,
	"phone" text,
	"country" text,
	"city" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "freelancer_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"headline" text DEFAULT '' NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"hourly_rate" numeric(10, 2) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'AED' NOT NULL,
	"location" text DEFAULT 'Dubai, UAE' NOT NULL,
	"skills" text[] DEFAULT '{}' NOT NULL,
	"portfolio" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"verification_status" text DEFAULT 'not_submitted' NOT NULL,
	"trust_score" integer DEFAULT 0 NOT NULL,
	"last_score_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "freelancer_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "client_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"company_name" text DEFAULT '' NOT NULL,
	"logo_url" text,
	"overview" text DEFAULT '' NOT NULL,
	"location" text DEFAULT 'Dubai, UAE' NOT NULL,
	"verification_status" text DEFAULT 'not_submitted' NOT NULL,
	"quality_score" integer DEFAULT 0 NOT NULL,
	"last_score_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "client_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "skills_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"category_slug" text NOT NULL,
	"budget_type" text NOT NULL,
	"budget_min" numeric(12, 2) DEFAULT '0' NOT NULL,
	"budget_max" numeric(12, 2) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'AED' NOT NULL,
	"skills" text[] DEFAULT '{}' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"deadline" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "proposals" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL,
	"freelancer_id" integer NOT NULL,
	"cover_letter" text NOT NULL,
	"expected_rate" numeric(12, 2) NOT NULL,
	"delivery_days" integer NOT NULL,
	"portfolio_links" text[] DEFAULT '{}' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "saved_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"job_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL,
	"client_id" integer NOT NULL,
	"freelancer_id" integer NOT NULL,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"sender_id" integer NOT NULL,
	"body" text NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL,
	"payer_id" integer NOT NULL,
	"payee_id" integer NOT NULL,
	"contract_id" integer,
	"milestone_id" integer,
	"amount" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'AED' NOT NULL,
	"platform_fee_pct" numeric(5, 2) DEFAULT '0' NOT NULL,
	"platform_fee_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"freelancer_net_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"invoice_number" text NOT NULL,
	"stripe_intent_id" text,
	"held_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	"refunded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL,
	"from_user_id" integer NOT NULL,
	"to_user_id" integer NOT NULL,
	"rating" integer NOT NULL,
	"comment" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"link" text,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "complaints" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_user_id" integer NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token_hash" text NOT NULL,
	"ip" text,
	"user_agent" text,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_verification_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" integer,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"old_value" jsonb,
	"new_value" jsonb,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"kind" text NOT NULL,
	"document_urls" text[] DEFAULT '{}' NOT NULL,
	"full_legal_name" text,
	"document_number" text,
	"notes" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"rejection_reason" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" integer
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL,
	"client_id" integer NOT NULL,
	"freelancer_id" integer NOT NULL,
	"proposal_id" integer NOT NULL,
	"contract_type" text DEFAULT 'fixed_price' NOT NULL,
	"title" text NOT NULL,
	"scope" text DEFAULT '' NOT NULL,
	"start_date" timestamp with time zone DEFAULT now() NOT NULL,
	"end_date" timestamp with time zone,
	"status" text DEFAULT 'pending_client_payment' NOT NULL,
	"total_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'AED' NOT NULL,
	"platform_fee_pct" numeric(5, 2) DEFAULT '10' NOT NULL,
	"cancelled_at" timestamp with time zone,
	"cancelled_by" integer,
	"cancellation_reason" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "milestones" (
	"id" serial PRIMARY KEY NOT NULL,
	"contract_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'AED' NOT NULL,
	"due_date" timestamp with time zone,
	"status" text DEFAULT 'pending_funding' NOT NULL,
	"escrow_state" text DEFAULT 'none' NOT NULL,
	"funded_at" timestamp with time zone,
	"submitted_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	"payment_id" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deliverables" (
	"id" serial PRIMARY KEY NOT NULL,
	"milestone_id" integer NOT NULL,
	"freelancer_id" integer NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"files" text[] DEFAULT '{}' NOT NULL,
	"revision_number" integer DEFAULT 1 NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_number" text NOT NULL,
	"contract_id" integer,
	"milestone_id" integer,
	"payment_id" integer,
	"client_id" integer NOT NULL,
	"freelancer_id" integer NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"subtotal" numeric(12, 2) NOT NULL,
	"vat_pct" numeric(5, 2) DEFAULT '5' NOT NULL,
	"vat_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'AED' NOT NULL,
	"trn" text,
	"place_of_supply" text DEFAULT 'AE' NOT NULL,
	"reverse_charge" boolean DEFAULT false NOT NULL,
	"invoice_type_code" text DEFAULT 'standard' NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"currency" text DEFAULT 'AED' NOT NULL,
	"available_balance" numeric(14, 2) DEFAULT '0' NOT NULL,
	"pending_balance" numeric(14, 2) DEFAULT '0' NOT NULL,
	"lifetime_earnings" numeric(14, 2) DEFAULT '0' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallets_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "wallet_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"wallet_id" integer NOT NULL,
	"type" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"currency" text DEFAULT 'AED' NOT NULL,
	"ref_type" text,
	"ref_id" integer,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" serial PRIMARY KEY NOT NULL,
	"freelancer_id" integer NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"currency" text DEFAULT 'AED' NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"method" text DEFAULT 'manual' NOT NULL,
	"note" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"processed_by" integer,
	"reference" text
);
--> statement-breakpoint
CREATE TABLE "dispute_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"dispute_id" integer NOT NULL,
	"sender_id" integer NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "disputes" (
	"id" serial PRIMARY KEY NOT NULL,
	"contract_id" integer NOT NULL,
	"milestone_id" integer,
	"raised_by_id" integer NOT NULL,
	"raised_against_id" integer NOT NULL,
	"kind" text NOT NULL,
	"subject" text NOT NULL,
	"description" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"resolution_notes" text,
	"resolved_by_id" integer,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"version" integer NOT NULL,
	"title_en" text NOT NULL,
	"title_ar" text NOT NULL,
	"body_en" text NOT NULL,
	"body_ar" text NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_by_id" integer
);
--> statement-breakpoint
CREATE TABLE "consents" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"document_id" integer NOT NULL,
	"document_slug" text NOT NULL,
	"document_version" integer NOT NULL,
	"ip" text,
	"user_agent" text,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"is_public" integer DEFAULT 0 NOT NULL,
	"description" text,
	"updated_by_id" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_search_alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"saved_search_id" integer NOT NULL,
	"job_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_searches" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"query" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notify" boolean DEFAULT true NOT NULL,
	"last_run_at" timestamp with time zone,
	"last_notified_job_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"uploader_id" integer NOT NULL,
	"kind" text DEFAULT 'general' NOT NULL,
	"original_name" text NOT NULL,
	"stored_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "device_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"platform" text NOT NULL,
	"token" text NOT NULL,
	"app_version" text,
	"locale" text,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "escrow_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"contract_id" integer,
	"milestone_id" integer,
	"payment_id" integer,
	"from_state" text,
	"to_state" text NOT NULL,
	"amount" numeric(14, 2),
	"currency" text DEFAULT 'AED' NOT NULL,
	"actor_user_id" integer,
	"reason" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payout_batch_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"batch_id" integer NOT NULL,
	"payout_id" integer NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payout_batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"currency" text DEFAULT 'AED' NOT NULL,
	"total_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"item_count" integer DEFAULT 0 NOT NULL,
	"note" text,
	"created_by_id" integer NOT NULL,
	"processed_by_id" integer,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "featured_listings" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"target_id" integer NOT NULL,
	"sponsor_user_id" integer,
	"payment_id" integer,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	"description_en" text,
	"description_ar" text,
	"audience" text NOT NULL,
	"period" text DEFAULT 'monthly' NOT NULL,
	"price_aed" numeric(12, 2) DEFAULT '0' NOT NULL,
	"features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"plan_id" integer NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"canceled_at" timestamp with time zone,
	"payment_id" integer,
	"auto_renew" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "moderation_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"target_kind" text NOT NULL,
	"target_id" integer NOT NULL,
	"reporter_user_id" integer,
	"reason" text NOT NULL,
	"details" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"action" text,
	"reviewed_by_id" integer,
	"reviewed_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "currencies" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	"symbol" text,
	"decimals" integer DEFAULT 2 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fx_rates" (
	"id" serial PRIMARY KEY NOT NULL,
	"base" text NOT NULL,
	"quote" text NOT NULL,
	"rate" numeric(18, 8) NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_gateways" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"provider_code" text NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"mode" text DEFAULT 'TEST' NOT NULL,
	"supported_currencies" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"config_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"contract_id" integer,
	"milestone_id" integer,
	"invoice_id" integer,
	"payment_id" integer,
	"gateway" text NOT NULL,
	"gateway_reference" text,
	"amount" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'AED' NOT NULL,
	"status" text DEFAULT 'INITIATED' NOT NULL,
	"payment_purpose" text DEFAULT 'milestone_funding' NOT NULL,
	"idempotency_key" text,
	"failure_reason" text,
	"proof_attachment_id" integer,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"captured_at" timestamp with time zone,
	"refunded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "payment_intents" (
	"id" serial PRIMARY KEY NOT NULL,
	"transaction_id" integer NOT NULL,
	"gateway" text NOT NULL,
	"intent_ref" text NOT NULL,
	"client_secret" text,
	"redirect_url" text,
	"status" text DEFAULT 'requires_payment' NOT NULL,
	"raw" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_webhooks" (
	"id" serial PRIMARY KEY NOT NULL,
	"gateway" text NOT NULL,
	"event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"transaction_id" integer,
	"signature_valid" boolean DEFAULT false NOT NULL,
	"processed" boolean DEFAULT false NOT NULL,
	"process_error" text,
	"raw" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "admin_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"subject_kind" text NOT NULL,
	"subject_id" integer NOT NULL,
	"author_id" integer NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cms_pages" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"locale" text NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"seo_title" text,
	"seo_description" text,
	"is_published" boolean DEFAULT false NOT NULL,
	"updated_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cms_blocks" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"locale" text NOT NULL,
	"title" text,
	"body" text DEFAULT '' NOT NULL,
	"updated_by_id" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blog_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"locale" text NOT NULL,
	"title" text NOT NULL,
	"excerpt" text DEFAULT '' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"cover_url" text,
	"category" text,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"seo_title" text,
	"seo_description" text,
	"is_published" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"author_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "faq_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"locale" text NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "testimonials" (
	"id" serial PRIMARY KEY NOT NULL,
	"locale" text NOT NULL,
	"author_name" text NOT NULL,
	"author_title" text,
	"body" text NOT NULL,
	"rating" integer DEFAULT 5 NOT NULL,
	"avatar_url" text,
	"is_featured" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "banned_words" (
	"id" serial PRIMARY KEY NOT NULL,
	"word" text NOT NULL,
	"locale" text DEFAULT 'any' NOT NULL,
	"severity" text DEFAULT 'med' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"route" text NOT NULL,
	"key" text NOT NULL,
	"user_id" integer,
	"request_hash" text NOT NULL,
	"response_status" integer NOT NULL,
	"response_snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "freelancer_profiles" ADD CONSTRAINT "freelancer_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_profiles" ADD CONSTRAINT "client_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_freelancer_id_users_id_fk" FOREIGN KEY ("freelancer_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_jobs" ADD CONSTRAINT "saved_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_jobs" ADD CONSTRAINT "saved_jobs_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_freelancer_id_users_id_fk" FOREIGN KEY ("freelancer_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_payer_id_users_id_fk" FOREIGN KEY ("payer_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_payee_id_users_id_fk" FOREIGN KEY ("payee_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_milestone_id_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."milestones"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_freelancer_id_users_id_fk" FOREIGN KEY ("freelancer_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_milestone_id_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."milestones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_freelancer_id_users_id_fk" FOREIGN KEY ("freelancer_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_milestone_id_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."milestones"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_freelancer_id_users_id_fk" FOREIGN KEY ("freelancer_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_freelancer_id_users_id_fk" FOREIGN KEY ("freelancer_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_processed_by_users_id_fk" FOREIGN KEY ("processed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_messages" ADD CONSTRAINT "dispute_messages_dispute_id_disputes_id_fk" FOREIGN KEY ("dispute_id") REFERENCES "public"."disputes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_messages" ADD CONSTRAINT "dispute_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_milestone_id_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."milestones"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_raised_by_id_users_id_fk" FOREIGN KEY ("raised_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_raised_against_id_users_id_fk" FOREIGN KEY ("raised_against_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_resolved_by_id_users_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_search_alerts" ADD CONSTRAINT "saved_search_alerts_saved_search_id_saved_searches_id_fk" FOREIGN KEY ("saved_search_id") REFERENCES "public"."saved_searches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_search_alerts" ADD CONSTRAINT "saved_search_alerts_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploader_id_users_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escrow_events" ADD CONSTRAINT "escrow_events_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escrow_events" ADD CONSTRAINT "escrow_events_milestone_id_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."milestones"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escrow_events" ADD CONSTRAINT "escrow_events_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escrow_events" ADD CONSTRAINT "escrow_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_batch_items" ADD CONSTRAINT "payout_batch_items_batch_id_payout_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."payout_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_batch_items" ADD CONSTRAINT "payout_batch_items_payout_id_payouts_id_fk" FOREIGN KEY ("payout_id") REFERENCES "public"."payouts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_batches" ADD CONSTRAINT "payout_batches_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_batches" ADD CONSTRAINT "payout_batches_processed_by_id_users_id_fk" FOREIGN KEY ("processed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_reports" ADD CONSTRAINT "moderation_reports_reporter_user_id_users_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_reports" ADD CONSTRAINT "moderation_reports_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_notes" ADD CONSTRAINT "admin_notes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "users_status_idx" ON "users" USING btree ("status");--> statement-breakpoint
CREATE INDEX "users_deleted_idx" ON "users" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "users_role_created_idx" ON "users" USING btree ("role","created_at");--> statement-breakpoint
CREATE INDEX "freelancer_profiles_trust_idx" ON "freelancer_profiles" USING btree ("trust_score");--> statement-breakpoint
CREATE INDEX "client_profiles_quality_idx" ON "client_profiles" USING btree ("quality_score");--> statement-breakpoint
CREATE INDEX "jobs_status_created_idx" ON "jobs" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "jobs_category_idx" ON "jobs" USING btree ("category_slug");--> statement-breakpoint
CREATE INDEX "jobs_client_idx" ON "jobs" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "jobs_deleted_idx" ON "jobs" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "proposals_job_idx" ON "proposals" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "proposals_freelancer_idx" ON "proposals" USING btree ("freelancer_id");--> statement-breakpoint
CREATE INDEX "proposals_status_idx" ON "proposals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "proposals_deleted_idx" ON "proposals" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "proposals_job_status_idx" ON "proposals" USING btree ("job_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "saved_jobs_user_job_uniq" ON "saved_jobs" USING btree ("user_id","job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_uniq" ON "conversations" USING btree ("job_id","client_id","freelancer_id");--> statement-breakpoint
CREATE INDEX "conversations_client_idx" ON "conversations" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "conversations_freelancer_idx" ON "conversations" USING btree ("freelancer_id");--> statement-breakpoint
CREATE INDEX "messages_conversation_idx" ON "messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "messages_sender_idx" ON "messages" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "messages_deleted_idx" ON "messages" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "payments_job_idx" ON "payments" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "payments_payer_idx" ON "payments" USING btree ("payer_id");--> statement-breakpoint
CREATE INDEX "payments_payee_idx" ON "payments" USING btree ("payee_id");--> statement-breakpoint
CREATE INDEX "payments_status_created_idx" ON "payments" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "reviews_from_user_idx" ON "reviews" USING btree ("from_user_id");--> statement-breakpoint
CREATE INDEX "reviews_to_user_idx" ON "reviews" USING btree ("to_user_id");--> statement-breakpoint
CREATE INDEX "reviews_job_idx" ON "reviews" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "reviews_deleted_idx" ON "reviews" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_user_read_idx" ON "notifications" USING btree ("user_id","read");--> statement-breakpoint
CREATE INDEX "notifications_user_created_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "complaints_status_idx" ON "complaints" USING btree ("status");--> statement-breakpoint
CREATE INDEX "complaints_from_user_idx" ON "complaints" USING btree ("from_user_id");--> statement-breakpoint
CREATE INDEX "refresh_tokens_user_idx" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "refresh_tokens_hash_idx" ON "refresh_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "password_reset_tokens_hash_idx" ON "password_reset_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "password_reset_tokens_user_idx" ON "password_reset_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "email_verification_tokens_hash_idx" ON "email_verification_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "email_verification_tokens_user_idx" ON "email_verification_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_user_idx" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "verifications_user_idx" ON "verifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verifications_status_idx" ON "verifications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "contracts_client_idx" ON "contracts" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "contracts_freelancer_idx" ON "contracts" USING btree ("freelancer_id");--> statement-breakpoint
CREATE INDEX "contracts_job_idx" ON "contracts" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "contracts_status_idx" ON "contracts" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "contracts_proposal_unique" ON "contracts" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "contracts_status_created_idx" ON "contracts" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "milestones_contract_idx" ON "milestones" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "milestones_status_idx" ON "milestones" USING btree ("status");--> statement-breakpoint
CREATE INDEX "milestones_contract_status_idx" ON "milestones" USING btree ("contract_id","status");--> statement-breakpoint
CREATE INDEX "deliverables_milestone_idx" ON "deliverables" USING btree ("milestone_id");--> statement-breakpoint
CREATE INDEX "invoices_client_idx" ON "invoices" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "invoices_freelancer_idx" ON "invoices" USING btree ("freelancer_id");--> statement-breakpoint
CREATE INDEX "invoices_payment_idx" ON "invoices" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "invoices_issued_idx" ON "invoices" USING btree ("issued_at");--> statement-breakpoint
CREATE INDEX "wallet_transactions_wallet_idx" ON "wallet_transactions" USING btree ("wallet_id");--> statement-breakpoint
CREATE INDEX "wallet_transactions_created_idx" ON "wallet_transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "wallet_transactions_type_idx" ON "wallet_transactions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "payouts_freelancer_idx" ON "payouts" USING btree ("freelancer_id");--> statement-breakpoint
CREATE INDEX "payouts_status_idx" ON "payouts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payouts_status_requested_idx" ON "payouts" USING btree ("status","requested_at");--> statement-breakpoint
CREATE INDEX "dispute_messages_dispute_idx" ON "dispute_messages" USING btree ("dispute_id");--> statement-breakpoint
CREATE INDEX "disputes_contract_idx" ON "disputes" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "disputes_status_idx" ON "disputes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "disputes_raised_by_idx" ON "disputes" USING btree ("raised_by_id");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_documents_slug_version_uniq" ON "legal_documents" USING btree ("slug","version");--> statement-breakpoint
CREATE INDEX "legal_documents_slug_current_idx" ON "legal_documents" USING btree ("slug","is_current");--> statement-breakpoint
CREATE INDEX "consents_user_idx" ON "consents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "consents_doc_idx" ON "consents" USING btree ("document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "saved_search_alerts_pair_uidx" ON "saved_search_alerts" USING btree ("saved_search_id","job_id");--> statement-breakpoint
CREATE INDEX "saved_searches_user_idx" ON "saved_searches" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "attachments_uploader_idx" ON "attachments" USING btree ("uploader_id");--> statement-breakpoint
CREATE INDEX "attachments_sha256_idx" ON "attachments" USING btree ("sha256");--> statement-breakpoint
CREATE INDEX "attachments_deleted_idx" ON "attachments" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "device_tokens_user_idx" ON "device_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "device_tokens_token_uidx" ON "device_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "escrow_events_milestone_idx" ON "escrow_events" USING btree ("milestone_id");--> statement-breakpoint
CREATE INDEX "escrow_events_contract_idx" ON "escrow_events" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "escrow_events_created_idx" ON "escrow_events" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payout_batch_items_payout_uidx" ON "payout_batch_items" USING btree ("payout_id");--> statement-breakpoint
CREATE INDEX "payout_batch_items_batch_idx" ON "payout_batch_items" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "payout_batches_status_idx" ON "payout_batches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "featured_listings_kind_target_idx" ON "featured_listings" USING btree ("kind","target_id");--> statement-breakpoint
CREATE INDEX "featured_listings_ends_at_idx" ON "featured_listings" USING btree ("ends_at");--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_plans_slug_uidx" ON "subscription_plans" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "user_subs_user_status_idx" ON "user_subscriptions" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "moderation_reports_status_idx" ON "moderation_reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "moderation_reports_target_idx" ON "moderation_reports" USING btree ("target_kind","target_id");--> statement-breakpoint
CREATE INDEX "moderation_reports_reporter_idx" ON "moderation_reports" USING btree ("reporter_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "currencies_code_uidx" ON "currencies" USING btree ("code");--> statement-breakpoint
CREATE INDEX "fx_rates_pair_fetched_idx" ON "fx_rates" USING btree ("base","quote","fetched_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_gateways_provider_uidx" ON "payment_gateways" USING btree ("provider_code");--> statement-breakpoint
CREATE INDEX "payment_gateways_active_idx" ON "payment_gateways" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "payment_transactions_user_idx" ON "payment_transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "payment_transactions_contract_idx" ON "payment_transactions" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "payment_transactions_milestone_idx" ON "payment_transactions" USING btree ("milestone_id");--> statement-breakpoint
CREATE INDEX "payment_transactions_status_idx" ON "payment_transactions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payment_transactions_gateway_idx" ON "payment_transactions" USING btree ("gateway");--> statement-breakpoint
CREATE INDEX "payment_transactions_created_idx" ON "payment_transactions" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_transactions_idem_uidx" ON "payment_transactions" USING btree ("gateway","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_transactions_gw_ref_uidx" ON "payment_transactions" USING btree ("gateway","gateway_reference");--> statement-breakpoint
CREATE INDEX "payment_intents_tx_idx" ON "payment_intents" USING btree ("transaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_intents_ref_uidx" ON "payment_intents" USING btree ("gateway","intent_ref");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_webhooks_event_uidx" ON "payment_webhooks" USING btree ("gateway","event_id");--> statement-breakpoint
CREATE INDEX "payment_webhooks_gateway_idx" ON "payment_webhooks" USING btree ("gateway");--> statement-breakpoint
CREATE INDEX "payment_webhooks_type_idx" ON "payment_webhooks" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "admin_notes_subject_idx" ON "admin_notes" USING btree ("subject_kind","subject_id");--> statement-breakpoint
CREATE INDEX "admin_notes_author_idx" ON "admin_notes" USING btree ("author_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cms_pages_slug_locale_uq" ON "cms_pages" USING btree ("slug","locale");--> statement-breakpoint
CREATE UNIQUE INDEX "cms_blocks_key_locale_uq" ON "cms_blocks" USING btree ("key","locale");--> statement-breakpoint
CREATE UNIQUE INDEX "blog_posts_slug_locale_uq" ON "blog_posts" USING btree ("slug","locale");--> statement-breakpoint
CREATE INDEX "blog_posts_published_idx" ON "blog_posts" USING btree ("is_published","published_at");--> statement-breakpoint
CREATE INDEX "faq_items_locale_cat_idx" ON "faq_items" USING btree ("locale","category","sort_order");--> statement-breakpoint
CREATE INDEX "testimonials_locale_idx" ON "testimonials" USING btree ("locale","is_featured","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "banned_words_word_locale_uq" ON "banned_words" USING btree ("word","locale");--> statement-breakpoint
CREATE UNIQUE INDEX "idempotency_keys_route_key_uidx" ON "idempotency_keys" USING btree ("route","key");--> statement-breakpoint
CREATE INDEX "idempotency_keys_created_idx" ON "idempotency_keys" USING btree ("created_at");
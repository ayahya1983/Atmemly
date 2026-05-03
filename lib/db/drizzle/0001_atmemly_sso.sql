CREATE TABLE "identity_providers" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"type" text NOT NULL,
	"display_name" text NOT NULL,
	"display_name_ar" text,
	"enabled" boolean DEFAULT false NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"issuer_url" text,
	"client_id" text,
	"client_secret_ref" text,
	"scopes" text DEFAULT 'openid email profile' NOT NULL,
	"auto_provision" boolean DEFAULT false NOT NULL,
	"allowed_domains" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"default_role" text DEFAULT 'client' NOT NULL,
	"role_mapping_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" integer,
	CONSTRAINT "identity_providers_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "user_identities" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"provider_id" integer NOT NULL,
	"external_id" text NOT NULL,
	"email" text,
	"display_name" text,
	"raw_claims" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sso_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider_id" integer NOT NULL,
	"state" text NOT NULL,
	"nonce" text NOT NULL,
	"code_verifier" text,
	"redirect_uri" text NOT NULL,
	"return_to" text,
	"link_user_id" integer,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sso_sessions_state_unique" UNIQUE("state")
);
--> statement-breakpoint
CREATE TABLE "organization_sso_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"provider_id" integer NOT NULL,
	"force_sso" boolean DEFAULT false NOT NULL,
	"domains" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"provider_id" integer,
	"provider_slug" text,
	"email" text,
	"action" text NOT NULL,
	"outcome" text NOT NULL,
	"reason" text,
	"ip" text,
	"user_agent" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_identities" ADD CONSTRAINT "user_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_identities" ADD CONSTRAINT "user_identities_provider_id_identity_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."identity_providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sso_sessions" ADD CONSTRAINT "sso_sessions_provider_id_identity_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."identity_providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_sso_settings" ADD CONSTRAINT "organization_sso_settings_provider_id_identity_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."identity_providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "identity_providers_enabled_idx" ON "identity_providers" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "identity_providers_type_idx" ON "identity_providers" USING btree ("type");--> statement-breakpoint
CREATE UNIQUE INDEX "user_identities_provider_external_uq" ON "user_identities" USING btree ("provider_id","external_id");--> statement-breakpoint
CREATE INDEX "user_identities_user_idx" ON "user_identities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_identities_email_idx" ON "user_identities" USING btree ("email");--> statement-breakpoint
CREATE INDEX "sso_sessions_expires_idx" ON "sso_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "sso_sessions_provider_idx" ON "sso_sessions" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "organization_sso_settings_org_idx" ON "organization_sso_settings" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "organization_sso_settings_provider_idx" ON "organization_sso_settings" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "login_audit_logs_user_idx" ON "login_audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "login_audit_logs_provider_idx" ON "login_audit_logs" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "login_audit_logs_outcome_idx" ON "login_audit_logs" USING btree ("outcome");--> statement-breakpoint
CREATE INDEX "login_audit_logs_created_idx" ON "login_audit_logs" USING btree ("created_at");
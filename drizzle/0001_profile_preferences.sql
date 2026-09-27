ALTER TABLE "profiles" ADD COLUMN "default_style" text DEFAULT 'classic-whiteboard' NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "default_duration_minutes" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_default_style_check" CHECK ("profiles"."default_style" in ('classic-whiteboard', 'paper-desk', 'color-markers'));--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_default_duration_check" CHECK ("profiles"."default_duration_minutes" in (1, 3, 5));
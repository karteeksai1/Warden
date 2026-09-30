DO $$ BEGIN
 CREATE TYPE "public"."approval_status" AS ENUM('pending', 'approved', 'rejected', 'expired', 'executed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."policy_decision" AS ENUM('allow', 'deny', 'require_approval');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."server_status" AS ENUM('healthy', 'unhealthy', 'disabled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."server_transport" AS ENUM('http', 'stdio');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"api_key_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agents_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trace_id" uuid NOT NULL,
	"tool_name" text NOT NULL,
	"arguments" jsonb NOT NULL,
	"arguments_hash" text NOT NULL,
	"status" "approval_status" DEFAULT 'pending' NOT NULL,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "servers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"transport" "server_transport" NOT NULL,
	"endpoint" text NOT NULL,
	"status" "server_status" DEFAULT 'healthy' NOT NULL,
	"last_health_check_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "servers_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"server_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"input_schema" jsonb NOT NULL,
	"schema_hash" text NOT NULL,
	"approved_hash" text,
	"quarantined" boolean DEFAULT false NOT NULL,
	"is_core" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "traces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" text NOT NULL,
	"agent_id" uuid NOT NULL,
	"tool_id" uuid,
	"tool_name" text NOT NULL,
	"arguments" jsonb,
	"result" jsonb,
	"policy_decision" "policy_decision" NOT NULL,
	"scanner_verdict" jsonb,
	"latency_ms" integer NOT NULL,
	"tokens_in" integer DEFAULT 0 NOT NULL,
	"tokens_out" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "approvals" ADD CONSTRAINT "approvals_trace_id_traces_id_fk" FOREIGN KEY ("trace_id") REFERENCES "public"."traces"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tools" ADD CONSTRAINT "tools_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "traces" ADD CONSTRAINT "traces_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "traces" ADD CONSTRAINT "traces_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "approvals_trace_id_idx" ON "approvals" USING btree ("trace_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "approvals_status_idx" ON "approvals" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tools_server_id_idx" ON "tools" USING btree ("server_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tools_name_idx" ON "tools" USING btree ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "traces_session_id_idx" ON "traces" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "traces_agent_id_idx" ON "traces" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "traces_created_at_idx" ON "traces" USING btree ("created_at");
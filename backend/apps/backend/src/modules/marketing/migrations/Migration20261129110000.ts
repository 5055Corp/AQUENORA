import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261129110000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "marketing_schedule" ("id" text not null, "seller_id" text not null, "subject" text not null, "message" text not null, "audience" text check ("audience" in ('all', 'repeat', 'lapsed')) not null, "every" text check ("every" in ('week', 'month')) not null, "next_run_at" timestamptz not null, "active" boolean not null default true, "last_sent_at" timestamptz null, "last_error" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_schedule_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_schedule_seller_id" ON "marketing_schedule" ("seller_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_schedule_next_run_at" ON "marketing_schedule" ("next_run_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_schedule_deleted_at" ON "marketing_schedule" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "marketing_schedule" cascade;`);
  }

}

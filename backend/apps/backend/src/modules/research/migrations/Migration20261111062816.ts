import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261111062816 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "seller_interview" ("id" text not null, "answers" jsonb not null, "name" text null, "email" text null, "phone" text null, "contact_ok" boolean not null default false, "wants_early_access" boolean not null default false, "country" text null, "source" text null, "version" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "seller_interview_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_seller_interview_deleted_at" ON "seller_interview" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "seller_interview" cascade;`);
  }

}

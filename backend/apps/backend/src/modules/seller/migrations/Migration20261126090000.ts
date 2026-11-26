import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261126090000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "seller" add column if not exists "suspended_at" timestamptz null;`);
    this.addSql(`alter table if exists "seller" add column if not exists "suspend_reason" text null;`);

    this.addSql(`create table if not exists "dispute" ("id" text not null, "order_id" text not null, "seller_id" text not null, "order_display_id" integer not null, "buyer_email" text not null, "buyer_name" text null, "reason" text check ("reason" in ('not_arrived', 'wrong_item', 'damaged', 'not_as_described', 'other')) not null, "status" text check ("status" in ('open', 'replied', 'refunded', 'escalated', 'resolved')) not null default 'open', "messages" jsonb not null, "refund" jsonb null, "decision" jsonb null, "reply_by" timestamptz not null, "resolved_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "dispute_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_dispute_order_id_unique" ON "dispute" ("order_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dispute_seller_id" ON "dispute" ("seller_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dispute_deleted_at" ON "dispute" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "dispute_file" ("id" text not null, "dispute_id" text not null, "from" text check ("from" in ('buyer', 'seller')) not null, "mime_type" text not null, "data" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "dispute_file_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dispute_file_dispute_id" ON "dispute_file" ("dispute_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dispute_file_deleted_at" ON "dispute_file" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "product_report" ("id" text not null, "product_id" text not null, "seller_id" text not null, "reason" text check ("reason" in ('counterfeit', 'prohibited', 'misleading', 'offensive', 'scam', 'other')) not null, "note" text null, "status" text check ("status" in ('open', 'actioned', 'dismissed')) not null default 'open', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "product_report_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_product_report_product_id" ON "product_report" ("product_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_product_report_seller_id" ON "product_report" ("seller_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_product_report_deleted_at" ON "product_report" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "product_report" cascade;`);
    this.addSql(`drop table if exists "dispute_file" cascade;`);
    this.addSql(`drop table if exists "dispute" cascade;`);
    this.addSql(`alter table if exists "seller" drop column if exists "suspended_at";`);
    this.addSql(`alter table if exists "seller" drop column if exists "suspend_reason";`);
  }

}

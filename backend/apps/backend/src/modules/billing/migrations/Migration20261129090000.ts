import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261129090000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "billing_settings" add column if not exists "booking_fee_percent" real not null default 3, add column if not exists "free_emails_per_month" integer not null default 100, add column if not exists "extra_email_price_ngn" real not null default 20;`);
    this.addSql(`create table if not exists "email_purchase" ("id" text not null, "reference" text not null, "seller_id" text not null, "count" integer not null, "status" text check ("status" in ('pending', 'paid', 'failed')) not null default 'pending', "amount" numeric not null, "raw_amount" jsonb not null, "currency_code" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "email_purchase_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_email_purchase_reference_unique" ON "email_purchase" ("reference") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_email_purchase_seller_id" ON "email_purchase" ("seller_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_email_purchase_deleted_at" ON "email_purchase" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "email_purchase" cascade;`);
    this.addSql(`alter table if exists "billing_settings" drop column if exists "booking_fee_percent", drop column if exists "free_emails_per_month", drop column if exists "extra_email_price_ngn";`);
  }

}

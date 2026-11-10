import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261110224717 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "checkout" drop constraint if exists "checkout_reference_unique";`);
    this.addSql(`create table if not exists "checkout" ("id" text not null, "reference" text not null, "seller_id" text not null, "status" text check ("status" in ('pending', 'paid')) not null default 'pending', "currency_code" text not null, "amount" numeric not null, "platform_fee" numeric not null, "commission_rate" real not null, "data" jsonb not null, "order_id" text null, "raw_amount" jsonb not null, "raw_platform_fee" jsonb not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "checkout_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_checkout_reference_unique" ON "checkout" ("reference") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_checkout_seller_id" ON "checkout" ("seller_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_checkout_deleted_at" ON "checkout" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "seller" add column if not exists "payout" jsonb null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "checkout" cascade;`);

    this.addSql(`alter table if exists "seller" drop column if exists "payout";`);
  }

}

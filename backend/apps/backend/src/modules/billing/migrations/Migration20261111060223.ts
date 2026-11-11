import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261111060223 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "pro_payment" drop constraint if exists "pro_payment_reference_unique";`);
    this.addSql(`create table if not exists "pro_payment" ("id" text not null, "reference" text not null, "seller_id" text not null, "kind" text check ("kind" in ('first', 'renewal')) not null, "status" text check ("status" in ('pending', 'paid', 'failed')) not null default 'pending', "amount" numeric not null, "currency_code" text not null, "price_amount" numeric not null, "price_currency_code" text not null, "period_end" timestamptz null, "message" text null, "raw_amount" jsonb not null, "raw_price_amount" jsonb not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "pro_payment_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_pro_payment_reference_unique" ON "pro_payment" ("reference") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_pro_payment_seller_id" ON "pro_payment" ("seller_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_pro_payment_deleted_at" ON "pro_payment" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "pro_payment" cascade;`);
  }

}

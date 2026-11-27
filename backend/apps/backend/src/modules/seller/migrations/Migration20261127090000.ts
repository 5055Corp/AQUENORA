import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261127090000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "stock_alert" ("id" text not null, "product_id" text not null, "seller_id" text not null, "email" text not null, "choice" text not null default '', "status" text check ("status" in ('waiting', 'sent')) not null default 'waiting', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "stock_alert_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_stock_alert_product_id" ON "stock_alert" ("product_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_stock_alert_seller_id" ON "stock_alert" ("seller_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_stock_alert_deleted_at" ON "stock_alert" ("deleted_at") WHERE deleted_at IS NULL;`);
    // One waiting alert per shopper, product and choice.
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_stock_alert_once" ON "stock_alert" ("product_id", "email", "choice") WHERE deleted_at IS NULL AND status = 'waiting';`);
    this.addSql(`alter table if exists "checkout" add column if not exists "reminded_at" timestamptz null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "stock_alert" cascade;`);
    this.addSql(`alter table if exists "checkout" drop column if exists "reminded_at";`);
  }

}

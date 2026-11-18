import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261118090000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "store_visit" ("id" text not null, "seller_id" text not null, "day" text not null, "source" text not null, "count" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "store_visit_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_store_visit_seller_id" ON "store_visit" ("seller_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_store_visit_deleted_at" ON "store_visit" ("deleted_at") WHERE deleted_at IS NULL;`);
    // One row per store, day and source: a visit adds 1 to it.
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_store_visit_seller_day_source" ON "store_visit" ("seller_id", "day", "source");`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "store_visit" cascade;`);
  }

}

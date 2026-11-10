import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261109193245 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "plan_price" drop constraint if exists "plan_price_country_code_unique";`);
    this.addSql(`create table if not exists "billing_settings" ("id" text not null, "free_commission_percent" real not null default 3, "pro_commission_percent" real not null default 1, "trial_days" integer not null default 14, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "billing_settings_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_billing_settings_deleted_at" ON "billing_settings" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "plan_price" ("id" text not null, "country_code" text not null, "currency_code" text not null, "monthly_price" integer not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "plan_price_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_plan_price_country_code_unique" ON "plan_price" ("country_code") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_plan_price_deleted_at" ON "plan_price" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "billing_settings" cascade;`);

    this.addSql(`drop table if exists "plan_price" cascade;`);
  }

}

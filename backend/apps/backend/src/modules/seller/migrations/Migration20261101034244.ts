import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261101034244 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "seller" drop constraint if exists "seller_handle_unique";`);
    this.addSql(`create table if not exists "seller" ("id" text not null, "email" text not null, "name" text not null, "handle" text not null, "category" text not null default 'Fashion & clothing', "country_code" text check ("country_code" in ('NG', 'GH', 'ZA', 'CI', 'SN', 'DI')) not null default 'NG', "currency_code" text not null default 'ngn', "sells_abroad" boolean not null default true, "paystack_subaccount_code" text null, "theme" text check ("theme" in ('harmattan', 'lagos', 'savanna')) not null default 'harmattan', "accent" text check ("accent" in ('terracotta', 'leaf', 'indigo', 'hibiscus')) not null default 'terracotta', "font" text check ("font" in ('classic', 'modern', 'friendly')) not null default 'classic', "announcement" text null, "onboarding_completed" boolean not null default false, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "seller_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_seller_handle_unique" ON "seller" ("handle") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_seller_deleted_at" ON "seller" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "seller" cascade;`);
  }

}

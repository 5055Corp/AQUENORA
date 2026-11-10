import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261109193246 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "seller" add column if not exists "trial_ends_at" timestamptz null, add column if not exists "pro_paid_until" timestamptz null, add column if not exists "custom_domain" text null, add column if not exists "domain_verified_at" timestamptz null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "seller" drop column if exists "trial_ends_at", drop column if exists "pro_paid_until", drop column if exists "custom_domain", drop column if exists "domain_verified_at";`);
  }

}

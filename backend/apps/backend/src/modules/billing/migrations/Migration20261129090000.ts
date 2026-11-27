import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261129090000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "billing_settings" add column if not exists "booking_fee_percent" real not null default 3, add column if not exists "free_emails_per_month" integer not null default 100, add column if not exists "extra_email_price_ngn" real not null default 20;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "billing_settings" drop column if exists "booking_fee_percent", drop column if exists "free_emails_per_month", drop column if exists "extra_email_price_ngn";`);
  }

}

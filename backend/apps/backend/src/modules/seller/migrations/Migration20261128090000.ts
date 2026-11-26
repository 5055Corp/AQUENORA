import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261128090000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "seller" add column if not exists "trusted_devices" jsonb null, add column if not exists "device_code" jsonb null, add column if not exists "referred_by" text null, add column if not exists "referral_rewarded_at" timestamptz null;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_seller_referred_by" ON "seller" ("referred_by") WHERE deleted_at IS NULL AND referred_by IS NOT NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_seller_referred_by";`);
    this.addSql(`alter table if exists "seller" drop column if exists "trusted_devices", drop column if exists "device_code", drop column if exists "referred_by", drop column if exists "referral_rewarded_at";`);
  }

}

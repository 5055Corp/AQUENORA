import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261117090000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "seller" add column if not exists "verification_status" text check ("verification_status" in ('unverified', 'pending', 'verified', 'rejected')) not null default 'unverified';`);
    this.addSql(`alter table if exists "seller" add column if not exists "verification" jsonb null;`);
    this.addSql(`alter table if exists "seller" add column if not exists "verified_at" timestamptz null;`);
    // Sellers who joined before verification existed don't need to verify.
    this.addSql(`update "seller" set "verification_status" = 'verified', "verified_at" = now() where "verification_status" = 'unverified';`);

    this.addSql(`create table if not exists "seller_document" ("id" text not null, "seller_id" text not null, "kind" text check ("kind" in ('cac', 'id', 'selfie')) not null, "mime_type" text not null, "data" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "seller_document_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_seller_document_seller_id" ON "seller_document" ("seller_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_seller_document_deleted_at" ON "seller_document" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "seller_document" cascade;`);
    this.addSql(`alter table if exists "seller" drop column if exists "verification_status";`);
    this.addSql(`alter table if exists "seller" drop column if exists "verification";`);
    this.addSql(`alter table if exists "seller" drop column if exists "verified_at";`);
  }

}

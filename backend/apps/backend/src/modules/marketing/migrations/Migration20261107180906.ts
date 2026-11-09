import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261107180906 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "marketing_contact" drop constraint if exists "marketing_contact_seller_id_email_unique";`);
    this.addSql(`alter table if exists "marketing_contact" drop constraint if exists "marketing_contact_unsubscribe_token_unique";`);
    this.addSql(`create table if not exists "marketing_campaign" ("id" text not null, "seller_id" text not null, "subject" text not null, "message" text not null, "audience" text check ("audience" in ('all', 'repeat', 'lapsed')) not null, "recipient_count" integer not null default 0, "sent_count" integer not null default 0, "failed_count" integer not null default 0, "sent_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_campaign_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_campaign_deleted_at" ON "marketing_campaign" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "marketing_contact" ("id" text not null, "seller_id" text not null, "email" text not null, "name" text null, "subscribed" boolean not null default false, "consented_at" timestamptz null, "unsubscribed_at" timestamptz null, "unsubscribe_token" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_contact_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_marketing_contact_unsubscribe_token_unique" ON "marketing_contact" ("unsubscribe_token") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_contact_deleted_at" ON "marketing_contact" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_marketing_contact_seller_id_email_unique" ON "marketing_contact" ("seller_id", "email") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "marketing_campaign" cascade;`);

    this.addSql(`drop table if exists "marketing_contact" cascade;`);
  }

}

import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261129100000 extends Migration {

  override async up(): Promise<void> {
    // Services a provider offers.
    this.addSql(`create table if not exists "booking_service" ("id" text not null, "seller_id" text not null, "name" text not null, "description" text null, "duration_min" integer not null, "price" numeric not null, "raw_price" jsonb not null, "payment" text check ("payment" in ('deposit', 'full', 'none', 'contact')) not null default 'deposit', "addons" jsonb null, "deposit_type" text check ("deposit_type" in ('fixed', 'percent')) not null default 'fixed', "deposit_value" real not null default 0, "active" boolean not null default true, "sort" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "booking_service_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_booking_service_seller_id" ON "booking_service" ("seller_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_booking_service_deleted_at" ON "booking_service" ("deleted_at") WHERE deleted_at IS NULL;`);

    // Appointments.
    this.addSql(`create table if not exists "booking" ("id" text not null, "seller_id" text not null, "service_id" text not null, "service_name" text not null, "addons" jsonb null, "duration_min" integer not null, "starts_at" timestamptz not null, "ends_at" timestamptz not null, "status" text check ("status" in ('pending', 'confirmed', 'cancelled', 'completed', 'no_show')) not null default 'pending', "customer_name" text not null, "email" text not null, "phone" text not null, "note" text null, "currency_code" text not null, "price" numeric not null, "raw_price" jsonb not null, "deposit" numeric not null, "raw_deposit" jsonb not null, "paid" numeric not null, "raw_paid" jsonb not null, "tips" numeric not null, "raw_tips" jsonb not null, "refund_due" numeric not null, "raw_refund_due" jsonb not null, "refunded_at" timestamptz null, "cancelled_by" text check ("cancelled_by" in ('customer', 'seller')) null, "reminded_day_at" timestamptz null, "reminded_hour_at" timestamptz null, "rescheduled" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "booking_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_booking_seller_id" ON "booking" ("seller_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_booking_service_id" ON "booking" ("service_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_booking_starts_at" ON "booking" ("starts_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_booking_deleted_at" ON "booking" ("deleted_at") WHERE deleted_at IS NULL;`);

    // Online payments for bookings (deposit / full / balance / tip).
    this.addSql(`create table if not exists "booking_payment" ("id" text not null, "reference" text not null, "booking_id" text not null, "seller_id" text not null, "kind" text check ("kind" in ('booking', 'balance', 'tip')) not null, "status" text check ("status" in ('pending', 'paid', 'failed')) not null default 'pending', "currency_code" text not null, "amount" numeric not null, "raw_amount" jsonb not null, "fee" numeric not null, "raw_fee" jsonb not null, "total" numeric not null, "raw_total" jsonb not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "booking_payment_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_booking_payment_reference_unique" ON "booking_payment" ("reference") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_booking_payment_booking_id" ON "booking_payment" ("booking_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_booking_payment_seller_id" ON "booking_payment" ("seller_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_booking_payment_deleted_at" ON "booking_payment" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "seller" add column if not exists "booking_settings" jsonb null, add column if not exists "booking_email" jsonb null, add column if not exists "email_usage" jsonb null, add column if not exists "email_credits" integer not null default 0;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "booking_payment" cascade;`);
    this.addSql(`drop table if exists "booking" cascade;`);
    this.addSql(`drop table if exists "booking_service" cascade;`);
    this.addSql(`alter table if exists "seller" drop column if exists "booking_settings", drop column if exists "booking_email", drop column if exists "email_usage", drop column if exists "email_credits";`);
  }

}

import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261116090000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "seller" add column if not exists "marketplace_listed" boolean not null default true;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "seller" drop column if exists "marketplace_listed";`);
  }

}

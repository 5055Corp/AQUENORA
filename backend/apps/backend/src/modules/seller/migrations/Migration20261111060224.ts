import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261111060224 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "seller" add column if not exists "pro_billing" jsonb null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "seller" drop column if exists "pro_billing";`);
  }

}

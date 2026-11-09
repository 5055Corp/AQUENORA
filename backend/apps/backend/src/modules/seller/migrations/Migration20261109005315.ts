import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261109005315 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "seller" add column if not exists "design" jsonb null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "seller" drop column if exists "design";`);
  }

}

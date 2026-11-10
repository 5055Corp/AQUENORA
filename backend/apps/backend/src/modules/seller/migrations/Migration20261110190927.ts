import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261110190927 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "seller" add column if not exists "pickup" jsonb null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "seller" drop column if exists "pickup";`);
  }

}

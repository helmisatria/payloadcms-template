import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "audit_logs" ADD COLUMN "previous_value" jsonb;
  ALTER TABLE "audit_logs" ADD COLUMN "current_value" jsonb;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "audit_logs" DROP COLUMN "previous_value";
  ALTER TABLE "audit_logs" DROP COLUMN "current_value";`)
}

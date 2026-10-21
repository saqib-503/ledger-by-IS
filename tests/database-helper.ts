import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs/promises";
export const uid = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222";
export async function database() {
  const db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to authenticated;grant execute on function auth.uid() to authenticated;insert into auth.users values('${uid}'),('${other}');`,
  );
  await db.exec(
    await fs.readFile("supabase/migrations/202609050001_initial.sql", "utf8"),
  );
  await db.exec(
    await fs.readFile(
      "supabase/migrations/202609160001_orders_accounting.sql",
      "utf8",
    ),
  );
  return db;
}
export async function asUser(db: PGlite, id = uid) {
  await db.exec(
    `reset role;set role authenticated;set "request.jwt.claim.sub"='${id}';`,
  );
}

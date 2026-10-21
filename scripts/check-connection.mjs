import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .trim()
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i), line.slice(i + 1)];
    }),
);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const r = await fetch(url + "/auth/v1/settings", {
  headers: { apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY },
});
console.log("Auth settings HTTP", r.status);
const db = createClient(url, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
for (const table of ["invoices", "accounts", "trade_orders"]) {
  const { error } = await db.from(table).select("id").limit(1);
  console.log(
    `${table}:`,
    !error
      ? "present"
      : error.code === "42501"
        ? "present; anonymous access denied as expected"
        : `${error.code} ${error.message}`,
  );
}
console.log(
  "This read-only check does not verify authenticated workflows or apply migrations.",
);

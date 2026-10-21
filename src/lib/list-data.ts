import type { supabase } from "./supabase/server";
type Client = Awaited<ReturnType<typeof supabase>>;
export async function allRecords(
  db: Client,
  table: string,
  order: string,
  ascending = true,
  select = "*",
) {
  const rows: Record<string, unknown>[] = [];
  for (let offset = 0; ; offset += 1000) {
    const result = await db
      .from(table)
      .select(select)
      .order(order, { ascending })
      .order("id")
      .range(offset, offset + 999);
    if (result.error) return { data: null, error: result.error };
    rows.push(...(result.data as unknown as Record<string, unknown>[]));
    if (result.data.length < 1000) break;
  }
  return { data: rows, error: null };
}

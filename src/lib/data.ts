import { supabase } from "./supabase/server";
import type { Kind, Document } from "./types";
export async function getDocument(kind: Kind, id: string): Promise<Document> {
  const db = await supabase();
  const { data, error } = await db.rpc("read_document", {
    p_kind: kind,
    p_id: id,
  });
  if (error) throw new Error(error.message);
  return data as Document;
}

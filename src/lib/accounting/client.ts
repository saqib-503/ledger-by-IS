export async function accountingCommand(action: string, data: unknown = {}) {
  const r = await fetch("/api/accounting", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, data }),
  });
  const result = await r.json();
  if (!r.ok) throw new Error(result.error);
  return result as { id?: string; kind?: string; ok?: boolean };
}
export async function accountingDocument<T>(
  entity: string,
  id: string,
): Promise<T> {
  const r = await fetch(`/api/accounting?entity=${entity}&id=${id}`);
  const data = await r.json();
  if (!r.ok) throw new Error(data.error);
  return data;
}
export function today() {
  return new Date().toLocaleDateString("en-CA");
}

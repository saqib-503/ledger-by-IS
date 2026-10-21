import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";
import { allRecords } from "@/lib/list-data";
import { validateCommand } from "@/lib/accounting/validation";
import { z } from "zod";
function failure(e: unknown) {
  const message =
    e instanceof z.ZodError
      ? e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
      : e instanceof Error
        ? e.message
        : (e as { message?: string })?.message || "Request failed";
  return NextResponse.json({ error: message }, { status: 400 });
}
export async function GET(req: NextRequest) {
  const db = await supabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  try {
    const p = req.nextUrl.searchParams;
    if (p.has("entity")) {
      const entity = z
          .enum(["order", "bill", "journal"])
          .parse(p.get("entity")),
        id = z.uuid().parse(p.get("id"));
      const { data, error } = await db.rpc("accounting_document", {
        p_kind: entity,
        p_id: id,
      });
      if (error) throw error;
      return NextResponse.json(data);
    }
    if (p.has("report")) {
      const from = z.iso.date().parse(p.get("from")),
        to = z.iso.date().parse(p.get("to"));
      const { data, error } = await db.rpc("accounting_report", {
        p_from: from,
        p_to: to,
        p_account: p.get("account") ? z.uuid().parse(p.get("account")) : null,
        p_party: p.get("party") ? z.uuid().parse(p.get("party")) : null,
        p_party_kind: p.get("partyKind") || null,
      });
      if (error) throw error;
      return NextResponse.json(data);
    }
    const specs = [
      ["accounts", "code", "*"],
      ["suppliers", "name", "*"],
      ["customers", "name", "*"],
      ["trade_orders", "date", "*,total:total::text"],
      [
        "supplier_bills",
        "date",
        "*,total:total::text,subtotal:subtotal::text,tax_amount:tax_amount::text",
      ],
      ["journals", "date", "*"],
      ["settlements", "date", "*,amount:amount::text"],
      ["invoices", "date", "*,grand_total:grand_total::text"],
    ];
    const result = await Promise.all(
      specs.map(([table, order, select]) =>
        allRecords(db, table, order, !["date"].includes(order), select),
      ),
    );
    for (const r of result) if (r.error) throw r.error;
    const { data: config, error } = await db
      .from("accounting_config")
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return NextResponse.json({
      email: user.email,
      config,
      accounts: result[0].data,
      suppliers: result[1].data,
      customers: result[2].data,
      orders: result[3].data,
      bills: result[4].data,
      journals: result[5].data,
      settlements: result[6].data,
      invoices: result[7].data,
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: NextRequest) {
  if (!req.headers.get("content-type")?.includes("application/json"))
    return NextResponse.json({ error: "JSON required" }, { status: 415 });
  try {
    const origin = req.headers.get("origin");
    if (origin && new URL(origin).host !== req.headers.get("host"))
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    const db = await supabase();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    const body = await req.json();
    const action = z.string().parse(body.action);
    const input = validateCommand(action, body.data);
    const { data, error } = await db.rpc("accounting_command", {
      p_action: action,
      p_data: input,
    });
    if (error) throw error;
    return NextResponse.json(data);
  } catch (e) {
    return failure(e);
  }
}

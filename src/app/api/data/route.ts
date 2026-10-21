import { allRecords } from "@/lib/list-data";
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";
import {
  customerSchema,
  documentSchema,
  settingsSchema,
} from "@/lib/validation";
import { getDocument } from "@/lib/data";
import { calculate } from "@/lib/calculations";
import type { Kind } from "@/lib/types";
export async function GET(req: NextRequest) {
  const db = await supabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const kind = req.nextUrl.searchParams.get("kind");
  const id = req.nextUrl.searchParams.get("id");
  try {
    if ((kind === "invoice" || kind === "quotation") && id)
      return NextResponse.json(await getDocument(kind, id));
    const [c, s, i, q] = await Promise.all([
      allRecords(db, "customers", "name"),
      db.from("company_settings").select("*").maybeSingle(),
      allRecords(
        db,
        "invoices",
        "date",
        false,
        "*, grand_total:grand_total::text",
      ),
      allRecords(db, "quotations", "date", false),
    ]);
    for (const r of [c, s, i, q]) if (r.error) throw r.error;
    return NextResponse.json({
      customers: c.data,
      settings: s.data,
      invoices: i.data,
      quotations: q.data,
      email: user.email,
    });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : (e as { message: string }).message,
      },
      { status: 400 },
    );
  }
}
export async function POST(req: NextRequest) {
  if (!req.headers.get("content-type")?.includes("application/json"))
    return NextResponse.json({ error: "JSON required" }, { status: 415 });
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host"))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const db = await supabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  try {
    const body = await req.json();
    let result;
    if (body.entity === "customer") {
      const values = customerSchema.parse(body.data);
      result = body.id
        ? await db
            .from("customers")
            .update(values)
            .eq("id", body.id)
            .select()
            .single()
        : await db
            .from("customers")
            .insert({ ...values, owner_id: user.id })
            .select()
            .single();
    } else if (body.entity === "settings") {
      const values = settingsSchema.parse(body.data);
      result = await db
        .from("company_settings")
        .upsert({ ...values, owner_id: user.id }, { onConflict: "owner_id" })
        .select()
        .single();
    } else {
      const kind: Kind = body.kind;
      if (!["invoice", "quotation"].includes(kind))
        throw new Error("Invalid document type");
      if (body.action === "archive") {
        result = await db.rpc("archive_document", {
          p_kind: kind,
          p_id: body.id,
          p_archived: body.archived,
        });
      } else {
        let input = body.data;
        let target = kind;
        if (body.action === "duplicate" || body.action === "convert") {
          const source = await getDocument(kind, body.id);
          const { data: settings } = await db
            .from("company_settings")
            .select("*")
            .single();
          target = body.action === "convert" ? "invoice" : kind;
          input = {
            ...source,
            date: new Date().toISOString().slice(0, 10),
            status: "draft",
            sales_tax_rate: String(
              target === "invoice"
                ? body.action === "convert"
                  ? (settings?.sales_tax_rate ?? 18)
                  : source.sales_tax_rate
                : 0,
            ),
            advance_tax_rate: String(
              target === "invoice"
                ? body.action === "convert"
                  ? (settings?.advance_tax_rate ?? 0.5)
                  : source.advance_tax_rate
                : 0,
            ),
          };
        }
        const valid = documentSchema.parse(input);
        const totals = calculate(
          valid.items,
          valid.sales_tax_rate,
          valid.advance_tax_rate,
        );
        result = await db.rpc("save_document", {
          p_kind: target,
          p_data: { ...valid, ...totals },
          p_id: body.action ? null : body.id || null,
          p_version: body.version || null,
        });
        if (!result.error)
          return NextResponse.json({ id: result.data, kind: target });
      }
    }
    if (result.error) throw result.error;
    return NextResponse.json(result.data);
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : (e as { message: string }).message || "Request failed",
      },
      { status: 400 },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";
import { getDocument } from "@/lib/data";
import { buildWorkbook } from "@/lib/excel";
import { workbookHtml } from "@/lib/print";
import { launchPdfBrowser } from "@/lib/pdf-browser";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ kind: string; id: string }> },
) {
  const db = await supabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { kind, id } = await params;
  if (kind !== "invoice" && kind !== "quotation")
    return NextResponse.json(
      { error: "Unknown document type" },
      { status: 404 },
    );
  try {
    const doc = await getDocument(kind, id);
    const workbook = await buildWorkbook(kind, doc);
    const format = req.nextUrl.searchParams.get("format");
    const filename = doc.number.replace(/[^a-zA-Z0-9_-]/g, "_");
    const headers = {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    };
    if (format === "xlsx") {
      const bytes = await workbook.xlsx.writeBuffer();
      return new NextResponse(new Uint8Array(bytes), {
        headers: {
          ...headers,
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
        },
      });
    }
    const html = workbookHtml(workbook, kind, doc.number, format === "print");
    if (format === "pdf") {
      const browser = await launchPdfBrowser();
      try {
        const page = await browser.newPage();
        await page.route("**/*", (route) => route.abort());
        await page.setContent(html, { waitUntil: "load" });
        const bytes = await page.pdf({
          format: "A4",
          printBackground: true,
          preferCSSPageSize: true,
        });
        return new NextResponse(new Uint8Array(bytes), {
          headers: {
            ...headers,
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${filename}.pdf"`,
          },
        });
      } finally {
        await browser.close();
      }
    }
    return new NextResponse(html, {
      headers: {
        ...headers,
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy":
          "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; frame-ancestors 'self'",
      },
    });
  } catch (e) {
    console.error("Export failed", e);
    return NextResponse.json(
      {
        error:
          "Could not export this document. Check that it exists and the PDF browser is installed.",
      },
      { status: 400 },
    );
  }
}

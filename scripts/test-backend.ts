import http from "node:http";
import { database, asUser, uid } from "../tests/database-helper";
// Isolated Supabase-compatible adapter used only by the browser test process.
// Financial behavior runs against the same migration in embedded PostgreSQL.
export async function startTestBackend() {
  const db = await database();
  await asUser(db);
  const user = {
    id: uid,
    aud: "authenticated",
    role: "authenticated",
    email: "test@example.test",
    email_confirmed_at: new Date().toISOString(),
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
    created_at: new Date().toISOString(),
  };
  const token = [
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
      "base64url",
    ),
    Buffer.from(
      JSON.stringify({
        sub: uid,
        aud: "authenticated",
        role: "authenticated",
        email: user.email,
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      }),
    ).toString("base64url"),
    "test-signature",
  ].join(".");
  const server = http.createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    const send = (value: unknown, status = 200) => {
      res.statusCode = status;
      res.end(JSON.stringify(value));
    };
    try {
      const url = new URL(req.url!, "http://127.0.0.1:54329");
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = chunks.length
        ? JSON.parse(Buffer.concat(chunks).toString())
        : {};
      if (url.pathname === "/auth/v1/token")
        return send({
          access_token: token,
          token_type: "bearer",
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          refresh_token: "test-refresh-token",
          user,
        });
      if (url.pathname === "/auth/v1/user") {
        if (req.headers.authorization !== "Bearer " + token)
          return send({ message: "Not authenticated" }, 401);
        return send(user);
      }
      if (url.pathname === "/auth/v1/logout") return send({});
      if (req.headers.authorization !== "Bearer " + token)
        return send({ message: "Not authenticated" }, 401);
      if (url.pathname.startsWith("/rest/v1/rpc/")) {
        const fn = url.pathname.split("/").pop();
        if (
          ![
            "save_document",
            "read_document",
            "archive_document",
            "accounting_command",
            "accounting_document",
            "accounting_report",
          ].includes(fn!)
        )
          throw Error("Unknown RPC");
        const keys = Object.keys(body);
        const r = await db.query<{ result: unknown }>(
          `select ${fn}(${keys.map((k, i) => k + "=> $" + (i + 1)).join(",")}) as result`,
          Object.values(body).map((v) =>
            typeof v === "object" && v !== null ? JSON.stringify(v) : v,
          ),
        );
        return send(r.rows[0].result);
      }
      const table = url.pathname.split("/").pop()!;
      if (
        ![
          "company_settings",
          "customers",
          "invoices",
          "quotations",
          "accounts",
          "suppliers",
          "accounting_config",
          "trade_orders",
          "supplier_bills",
          "journals",
          "settlements",
        ].includes(table)
      )
        return send({ message: "Unknown table" }, 404);
      const id = url.searchParams.get("id")?.replace(/^eq\./, "");
      let rows;
      if (req.method === "GET") {
        rows = (
          await db.query(
            `select *${table === "invoices" ? ",grand_total::text as grand_total" : ""} from ${table}${id ? " where id=$1" : ""} order by ${["customers", "suppliers"].includes(table) ? "name" : table === "accounts" ? "code" : table === "accounting_config" ? "owner_id" : table === "company_settings" ? "created_at" : "date desc"}`,
            id ? [id] : [],
          )
        ).rows;
      } else {
        const keys = Object.keys(body);
        if (keys.some((k) => !/^[a-z_]+$/.test(k)))
          throw Error("Invalid field");
        const values = Object.values(body);
        if (req.method === "PATCH")
          rows = (
            await db.query(
              `update ${table} set ${keys.map((k, i) => k + "=$" + (i + 1)).join(",")} where id=$${keys.length + 1} returning *`,
              [...values, id],
            )
          ).rows;
        else
          rows = (
            await db.query(
              `insert into ${table}(${keys.join(",")}) values(${keys.map((_, i) => "$" + (i + 1)).join(",")}) ${table === "company_settings" ? "on conflict(owner_id) do update set " + keys.map((k) => k + "=excluded." + k).join(",") : ""} returning *`,
              values,
            )
          ).rows;
      }
      rows = rows.map((row: any) =>
        Object.fromEntries(
          Object.entries(row).map(([key, value]) => [
            key,
            value && ["date", "due_date", "locked_through"].includes(key)
              ? new Date(value as string).toISOString().slice(0, 10)
              : value,
          ]),
        ),
      );
      return send(
        String(req.headers.accept).includes("application/vnd.pgrst.object")
          ? (rows[0] ?? null)
          : rows,
      );
    } catch (e) {
      send({ message: (e as Error).message, code: "TEST_BACKEND_ERROR" }, 400);
    }
  });
  await new Promise<void>((resolve) =>
    server.listen(54329, "127.0.0.1", resolve),
  );
  return {
    close: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await db.close();
    },
  };
}

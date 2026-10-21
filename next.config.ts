import type { NextConfig } from "next";
const config: NextConfig = {
  serverExternalPackages: ["exceljs", "playwright"],
  outputFileTracingIncludes: { "/api/export/**/*": ["./templates/**/*"] },
};
export default config;

import type { NextConfig } from "next";
import fs from "node:fs";
import path from "node:path";

function loadRootPublicEnv(): Record<string, string> {
  const envMap: Record<string, string> = {};
  const rootEnvPath = path.resolve(process.cwd(), "../../.env");
  if (!fs.existsSync(rootEnvPath)) {
    return envMap;
  }
  const content = fs.readFileSync(rootEnvPath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    let val = line.slice(eqIdx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (key.startsWith("NEXT_PUBLIC_") && !process.env[key]) {
      process.env[key] = val;
      envMap[key] = val;
    }
  }
  return envMap;
}

const rootPublicEnv = loadRootPublicEnv();

const nextConfig: NextConfig = {
  /* config options here */
  env: rootPublicEnv,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

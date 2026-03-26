// Starts the API server — no build step required
import { spawnSync } from "child_process";

const result = spawnSync(
  "./artifacts/api-server/node_modules/.bin/tsx",
  ["artifacts/api-server/src/index.ts"],
  { stdio: "inherit", env: process.env }
);

process.exit(result.status ?? 0);

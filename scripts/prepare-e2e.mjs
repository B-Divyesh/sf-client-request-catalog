import { mkdirSync, rmSync } from "node:fs";

const dataDir = "/tmp/client-request-catalog-e2e";
rmSync(dataDir, { recursive: true, force: true });
mkdirSync(dataDir, { recursive: true });

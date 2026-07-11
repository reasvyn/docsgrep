import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CONFIG_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..", "..", "src", "config"
);

const cache = new Map<string, any>();

export function loadConfig<T = any>(name: string): T {
  if (cache.has(name)) return cache.get(name) as T;
  const filePath = path.join(CONFIG_DIR, `${name}.json`);
  if (!existsSync(filePath)) throw new Error(`Config not found: ${name}`);
  const raw = readFileSync(filePath, "utf-8");
  const data = JSON.parse(raw) as T;
  cache.set(name, data);
  return data;
}

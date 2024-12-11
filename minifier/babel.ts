import * as path from "https://deno.land/std@0.220.1/path/mod.ts";
import { ensureDir } from "https://deno.land/std@0.220.1/fs/ensure_dir.ts";
import { exists } from "https://deno.land/std@0.220.1/fs/exists.ts";
import { getCacheDir } from "~/misc/cache.ts";

interface BabelModule {
  transform(
    code: string,
    options?: Object,
  ): Promise<{ code: string }>;
}

export async function load(version: string) {
  return getCachedModule(version);
}

async function fetchAndCache(url: string, cachePath: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
  }
  const content = await response.text();
  await Deno.writeTextFile(cachePath, content);
  return content;
}

export async function transform({ code, config, babel }: {
  code: string;
  config: Record<string, any>;
  babel: BabelModule;
}) {
  const transpiledCode = await babel.transform(code, config);
  return transpiledCode.code.trim();
}

// TODO: Implement cache
async function getCachedModule(version: string): Promise<BabelModule> {
  // for version >= 7.14.0: https://cdn.jsdelivr.net/npm/@babel/standalone@7.14.0/babel.min.js
  const cacheDir = `${getCacheDir()}/babel/${version}`;
  const loaderCachePath = path.join(cacheDir, "index.js");

  const loaderUrl =
    `https://cdn.jsdelivr.net/npm/@babel/standalone@${version}/+esm`;

  await ensureDir(cacheDir);

  if (!(await exists(loaderCachePath))) {
    await fetchAndCache(loaderUrl, loaderCachePath);
  }

  const { transform } = await import(loaderCachePath);
  return { transform };
}

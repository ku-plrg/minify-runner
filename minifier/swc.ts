import * as path from "https://deno.land/std@0.220.1/path/mod.ts";
import { ensureDir } from "https://deno.land/std@0.220.1/fs/ensure_dir.ts";
import { exists } from "https://deno.land/std@0.220.1/fs/exists.ts";
import {
  greaterOrEqual,
  greaterThan,
  lessOrEqual,
  lessThan,
  parse,
} from "https://deno.land/std@0.220.1/semver/mod.ts";
import type {
  Config,
  Options,
  Output,
  ParseOptions,
  Script,
} from "https://esm.sh/@swc/types@0.1.6";
import { getCacheDir } from "~/misc/cache.ts";

export interface SwcModule {
  default(): Promise<unknown>;
  parseSync(code: string, options: ParseOptions & { isModule: false }): Script;
  transformSync(code: string, options: Options): Output;
}

export function getPackageName(version: string) {
  return greaterOrEqual(parse(version), parse("1.2.165")) &&
      lessOrEqual(parse(version), parse("1.2.170"))
    ? "@swc/binding_core_wasm"
    : "@swc/wasm-web";
}

export async function load(version: string): Promise<SwcModule> {
  return getCachedModule(version);
}

export function transform({ code, config, filename, swc }: {
  code: string;
  filename: string;
  config: Config;
  swc: SwcModule;
}): Output {
  return swc.transformSync(code, { ...config, filename });
}

async function getCachedModule(version: string) {
  const packageName = getPackageName(version);
  const entryFileName = greaterThan(parse(version), parse("1.2.165")) &&
      lessThan(parse(version), parse("1.6.7"))
    ? "wasm-web"
    : "wasm";
  const cacheDir = `${getCacheDir()}/swc/${version}`;
  const loaderCachePath = path.join(cacheDir, `${entryFileName}.js`);
  const wasmCachePath = path.join(cacheDir, `${entryFileName}_bg.wasm`);
  const loaderPath = new URL(
    `https://cdn.jsdelivr.net/npm/${packageName}@${version}/${entryFileName}.js`,
  );
  const wasmPath = new URL(`${entryFileName}_bg.wasm`, loaderPath);
  if (!(await exists(wasmCachePath) && await exists(loaderCachePath))) {
    await ensureDir(cacheDir);
    await Promise.all([
      (async () =>
        Deno.writeFile(loaderCachePath, (await fetch(loaderPath)).body!))(),
      (async () =>
        Deno.writeFile(wasmCachePath, (await fetch(wasmPath)).body!))(),
    ]);
  }
  const module: SwcModule = await import(loaderCachePath);
  await module.default();
  return module;
}

import * as path from "https://deno.land/std@0.220.1/path/mod.ts";
import { ensureDir } from "https://deno.land/std@0.220.1/fs/ensure_dir.ts";
import { exists } from "https://deno.land/std@0.220.1/fs/exists.ts";
import { getCacheDir } from "~/misc/cache.ts";

interface TerserModule {
  minify(
    code: string,
    config: Record<string, any>,
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

async function rewriteAbsolutePaths(filePath: string) {
  let content = await Deno.readTextFile(filePath);

  // Replace absolute URLs like "/npm/<module>" with local relative paths
  const regex = /from\s*['"]\/npm\/(.*?)['"]/g;
  content = content.replace(regex, (match, modulePath) => {
    const cachedModuleName = modulePath.replace(/\//g, "-") + ".js";
    const relativePath = `./${cachedModuleName}`;
    return `from '${relativePath}'`;
  });

  await Deno.writeTextFile(filePath, content);
}

export async function transform({ code, config, terser }: {
  code: string;
  config: Record<string, any>;
  terser: TerserModule;
}) {
  const minifiedCode = await terser.minify(code, config);
  return minifiedCode.code.trim();
}

async function getCachedModule(version: string): Promise<TerserModule> {
  const cacheDir = `${getCacheDir()}/terser/${version}`;
  const loaderCachePath = path.join(cacheDir, "index.js");

  const loaderUrl = `https://cdn.jsdelivr.net/npm/terser@${version}/+esm`;

  // Ensure the cache directory exists
  await ensureDir(cacheDir);

  // Cache the main Terser module
  if (!(await exists(loaderCachePath))) {
    const content = await fetchAndCache(loaderUrl, loaderCachePath);

    // Extract dependencies based on the structure of the file
    const dependencyRegex = /from\s*['"]\/npm\/(.*?)['"]/g;
    const dependencies = [...content.matchAll(dependencyRegex)].map(
      ([, modulePath]) => modulePath,
    );
    // console.log(dependencies);

    // Cache all dependencies
    for (const dependency of dependencies) {
      const dependencyUrl = `https://cdn.jsdelivr.net/npm/${dependency}`;
      const dependencyCachePath = path.join(
        cacheDir,
        dependency.replace(/\//g, "-") + ".js",
      );

      if (!(await exists(dependencyCachePath))) {
        await fetchAndCache(dependencyUrl, dependencyCachePath);
      }
    }

    // Rewrite absolute paths in the main file to relative paths
    await rewriteAbsolutePaths(loaderCachePath);
  }

  // Dynamically import the cached Terser module
  const { minify } = await import(loaderCachePath);
  return { minify };
}

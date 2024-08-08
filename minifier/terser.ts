import * as path from "https://deno.land/std@0.220.1/path/mod.ts";
import { ensureDir } from "https://deno.land/std@0.220.1/fs/ensure_dir.ts";
import { exists } from "https://deno.land/std@0.220.1/fs/exists.ts";
import {
    greaterOrEqual,
    lessOrEqual,
    parse,
} from "https://deno.land/std@0.220.1/semver/mod.ts";
import { relative } from "https://deno.land/std@0.220.1/path/relative.ts";
import { getCacheDir } from "~/misc/cache.ts";
import {
    CommandExecutableNotFoundError,
    MissingRequiredEnvVarError,
} from "https://deno.land/x/cliffy@v1.0.0-rc.3/command/_errors.ts";

interface terserModule {
    defaults(): Promise<unknown>;
    minify(
        code: string,
        config: Record<string, any>,
    ): Promise<{ code: string }>;
}

// https://cdn.jsdelivr.net/npm/terser@5.31.5/+esm
// version >= 3.10.1 https://cdn.jsdelivr.net/npm/terser@3.10.1/dist/bundle.min.js
// version <= 3.10.0 && version >= 3.7.7 https://cdn.jsdelivr.net/npm/terser@3.10.0/dist/browser.bundle.min.js
// version <= 3.7.6 https://cdn.jsdelivr.net/npm/terser@3.7.6/tools/node.min.js
export function getPackageName(version: string): string {
    return "terser";
}

export function getEntryFileName(version: string): string {
    return "+esm";
}

export async function loadTerserMinifier(version: string) {
    return getCachedModule(version);
}

export async function transformTerser({ code, config, minifier }: {
    code: string;
    config: Record<string, any>;
    minifier: any;
}) {
    console.log(minifier);
    const minifiedCode = await minifier(code, config); // ????
    return minifiedCode.code.trim();
}

async function getCachedModule(version: string) {
    const packageName = getPackageName(version);
    const entryFileName = getEntryFileName(version);
    const cacheDir = `${getCacheDir()}/terser/${version}`;
    // const loaderCachePath = path.join(cacheDir, entryFileName);
    const loaderPath =
        `https://cdn.jsdelivr.net/npm/${packageName}@${version}/${entryFileName}`;

    // @TODO: Implement cache
    // if (true || !(await exists(loaderCachePath))) {
    //     const directoryAux = (ver: string) => {
    //         if (greaterOrEqual(parse(ver), parse("3.7.7"))) {
    //             return "dist";
    //         } else {
    //             return "tools";
    //         }
    //     };
    //     await ensureDir(path.join(cacheDir, directoryAux(version)));
    //     await Promise.all([
    //         (async () => {
    //             await Deno.writeFile(
    //                 loaderCachePath,
    //                 (await fetch(loaderPath)).body!,
    //             );
    //         })(),
    //     ]);
    // }

    const module = await import(loaderPath);
    console.log(module);
    const { minify } = module;
    return minify;
}

import * as path from "https://deno.land/std@0.220.1/path/mod.ts";
import { getHomeDir } from "~/misc/env.ts";

export function getCacheDir() {
  return Deno.env.get("MINIFY_RUNNER_CACHE_DIR") ||
    path.resolve(getHomeDir(), ".cache/minify-runner");
}

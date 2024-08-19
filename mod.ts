import { Command } from "https://deno.land/x/cliffy@v1.0.0-rc.3/command/mod.ts";
import { load as loadSwc, transform as transformSwc } from "~/minifier/swc.ts";
import {
  load as loadTerser,
  transform as transformTerser,
} from "~/minifier/terser.ts";
import type { Config } from "https://esm.sh/v135/@swc/types@0.1.6";

await new Command()
  .name("minify-runner")
  .option("-v, --version <name@semver:string>", "minifier name with semver", {
    default: "swc@1.6.7",
  })
  .option("-f, --file", "Code is given by filename instead of string")
  .arguments("<codeOrFilePath:string>")
  .action(async ({ version, file }, codeOrFilePath) => {
    const [name, semver] = version.split("@");
    const code = file
      ? await Deno.readTextFile(codeOrFilePath)
      : codeOrFilePath;
    switch (name) {
      case "swc": {
        const swc = await loadSwc(semver);
        const config = JSON.parse(
          await Deno.readTextFile(new URL(".swcrc", import.meta.url)),
        ) as Config;
        const { code: output } = transformSwc({
          code,
          config,
          filename: "tmp.js",
          swc,
        });
        console.log(output.trim());
        return;
      }
      case "terser": {
        const terser = await loadTerser(semver);
        const config = JSON.parse(
          await Deno.readTextFile(new URL(".terserrc", import.meta.url)),
        );
        const output = await transformTerser({
          code,
          config,
          terser,
        });
        console.log(output.trim());
        return;
      }
      default:
        throw "invalid minifier name";
    }
  })
  .parse(Deno.args);

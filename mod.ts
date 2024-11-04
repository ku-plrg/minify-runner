import { Command } from "https://deno.land/x/cliffy@v1.0.0-rc.4/command/mod.ts";
import { load as loadSwc, transform as transformSwc } from "~/minifier/swc.ts";
import {
  load as loadTerser,
  transform as transformTerser,
} from "~/minifier/terser.ts";
import type { Config } from "https://esm.sh/v135/@swc/types@0.1.6";

import { minifyCheck } from "~/minifyCheck/minifyCheck.ts";

interface MinifierOptions {
  version: string; // semver
  file?: boolean;
  diff: boolean;
}

await new Command()
  .name("minify-runner")
  .option("-v, --version <name@semver:string>", "minifier name with semver", {
    default: "swc@1.6.7",
  })
  .option("-f, --file", "Code is given by filename instead of string")
  .option(
    "-d, --diff",
    "Show difference between original and minified code",
    {
      default: false,
    },
  )
  .arguments("<codeOrFilePath:string>")
  .action(
    async (
      options: Record<string, any>, // to be refactored
      codeOrFilePath: string,
    ) => {
      const { version, file, diff } = options as MinifierOptions; // to be refactored
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
          if (diff) {
            const config = JSON.parse(
              await Deno.readTextFile(
                new URL(".acornrc", import.meta.url),
              ),
            );
            console.log("======================================");
            console.log(await minifyCheck(code, output, config));
          }
          break;
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
          if (diff) {
            const config = JSON.parse(
              await Deno.readTextFile(
                new URL(".acornrc", import.meta.url),
              ),
            );
            console.log("======================================");
            console.log(await minifyCheck(code, output, config));
          }
          break;
        }
        default:
          throw "invalid minifier name";
      }
    },
  )
  .parse(Deno.args);

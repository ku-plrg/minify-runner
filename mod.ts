import { Command } from "https://deno.land/x/cliffy@v1.0.0-rc.4/command/mod.ts";
import { load as loadSwc, transform as transformSwc } from "~/minifier/swc.ts";
import {
  load as loadTerser,
  transform as transformTerser,
} from "~/minifier/terser.ts";
import {
  load as loadBabel,
  transform as transformBabel,
} from "~/minifier/babel.ts";
import type { Config } from "https://esm.sh/v135/@swc/types@0.1.6";

import { minifyCheck } from "~/minifyCheck/minifyCheck.ts";
import { findTriggeredOptionsCommand } from "~/minifyCheck/findTriggeredOption.ts";

interface MinifierOptions {
  version: string; // semver
  file?: boolean;
  diff: boolean;
}

// valid target values for swc
// todo: refactor to get dynamically
const validJscTargetSwc: String[] = [
  "es3",
  "es5",
  "es2015",
  "es2016",
  "es2017",
  "es2018",
  "es2019",
  "es2020",
  "es2021",
  "es2022",
  "esnext",
];

await new Command()
  .name("minify-runner")
  .option("-v, --version <name@semver:string>", "minifier name with semver", {
    default: "swc@1.4.6",
  })
  .option("-f, --file", "Code is given by filename instead of string")
  .option(
    "-d, --diff",
    "Show difference between original and minified code",
    {
      default: false,
    },
  )
  .option(
    // note that target is temporarily implemented only for swc
    "-t, --target <target:string>",
    "target ES version",
    {
      default: null, // if null, it follows the default .swcrc files
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
          const config: Config = JSON.parse(
            await Deno.readTextFile(new URL(".swcrc", import.meta.url)),
          ) as Config;
          if (options.target) {
            const target = options.target.toLowerCase().trim();
            if (validJscTargetSwc.includes(target)) {
              config.jsc ??= {};
              config.jsc.target = target;
            } else {
              throw new Error(
                `Invalid target value. Valid values are ${
                  validJscTargetSwc.join(
                    ", ",
                  )
                }`,
              );
            }
          }
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
        case "babel": {
          const babel = await loadBabel(semver);
          const config = JSON.parse(
            await Deno.readTextFile(new URL(".babelrc", import.meta.url)),
          );
          const output = await transformBabel({
            code,
            config,
            babel,
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
  .command("find-triggered-options", findTriggeredOptionsCommand)
  .parse(Deno.args);

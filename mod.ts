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
  .option("-d, --diff", "Show difference between original and minified code", {
    default: false,
  })
  .option(
    // note that target is temporarily implemented only for swc
    "-t, --target <target:string>",
    "target ES version",
    {
      default: null, // if null, it follows the default .swcrc files
    },
  )
  .option("-n, --notcompress", "Do not compress the code", {
    // note that notcompress is temporarily implemented only for swc
    default: false, // false is compress
  })
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
          if (options.notcompress) {
            config.jsc ??= {};
            config.jsc.minify = {};
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
              await Deno.readTextFile(new URL(".acornrc", import.meta.url)),
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
              await Deno.readTextFile(new URL(".acornrc", import.meta.url)),
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
              await Deno.readTextFile(new URL(".acornrc", import.meta.url)),
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
  .command(
    "test-es2015",
    new Command()
      .description("Test ES2015+ features by transpiling them to ES2015")
      .action(async () => {
        const dirPath = "./test-es2015";
        let successcase = 0;
        let failcase = 0;
        for await (const entry of Deno.readDir(dirPath)) {
          if (entry.isFile && entry.name.endsWith(".js")) {
            const filePath = `${dirPath}/${entry.name}`;
            const originalCode = await Deno.readTextFile(filePath);
            const babel = await loadBabel("7.19.1");
            const config = JSON.parse(
              await Deno.readTextFile(new URL(".babelrc", import.meta.url)),
            );
            const transpiledCode = await transformBabel({
              code: originalCode,
              config,
              babel,
            });
            if (
              originalCode.replace(/\s+/g, "") !==
                transpiledCode.replace(/\s+/g, "")
            ) {
              console.log(`Differences found in ${entry.name}:`);
              console.log("Original Code:");
              console.log(originalCode);
              console.log("Transpiled Code:");
              console.log(transpiledCode);
              failcase++;
            } else {
              console.log(`No differences found in ${entry.name}.`);
              successcase++;
            }
          }
        }
        // result phase
        console.log("Test finished.");
        console.log("Success cases:", successcase);
        console.log("Fail cases:", failcase);
      }),
  )
  .command(
    "get-transpilable-rate",
    new Command()
      .description("Get transpilable rate of ES2015+ features to ES2015")
      .option(
        "-v, --version <name@semver:string>",
        "minifier name with semver",
        {
          default: "babel@7.19.1",
        },
      )
      .arguments("<dirPath:string>")
      .action(async (
        { version }: { version: string },
        dirPath: string,
      ) => {
        const [name, semver] = version.split("@");

        let successcase = 0;
        let failcase = 0;

        const checkTranspilable = async (
          originalCode: string,
          name: string,
        ) => {
          const configAcorn = JSON.parse(
            await Deno.readTextFile(new URL(".acornrc", import.meta.url)),
          );
          switch (name) {
            case "swc":
              const swc = await loadSwc(semver);
              const configSwc: Config = JSON.parse(
                await Deno.readTextFile(new URL(".swcrc", import.meta.url)),
              ) as Config;
              const { code: outputSwc } = transformSwc({
                code: originalCode,
                config: configSwc,
                filename: "tmp.js",
                swc,
              });
              console.log(outputSwc.trim());
              if (await minifyCheck(originalCode, outputSwc, configAcorn)) {
                return true;
              } else {
                return false;
              }
              break;
            case "terser":
              const terser = await loadTerser(semver);
              const configTerser = JSON.parse(
                await Deno.readTextFile(new URL(".terserrc", import.meta.url)),
              );
              const outputTerser = await transformTerser({
                code: originalCode,
                config: configTerser,
                terser,
              });

              if (await minifyCheck(originalCode, outputTerser, configAcorn)) {
                return true;
              } else {
                return false;
              }
              break;
            case "babel":
              const babel = await loadBabel(semver);
              const configBabel = JSON.parse(
                await Deno.readTextFile(new URL(".babelrc", import.meta.url)),
              );
              const outputBabel = await transformBabel({
                code: originalCode,
                config: configBabel,
                babel,
              });
              if (await minifyCheck(originalCode, outputBabel, configAcorn)) {
                return true;
              } else {
                return false;
              }
              break;

            default:
              throw "invalid minifier name";
          }
        };

        for await (const entry of Deno.readDir(dirPath)) {
          if (entry.isFile && entry.name.endsWith(".js")) {
            const filePath = `${dirPath}/${entry.name}`;
            const originalCode = '"use strict;"\n' +
              await Deno.readTextFile(filePath);
            if (await checkTranspilable(originalCode, name)) {
              successcase++;
            } else {
              failcase++;
            }
          }
        }
      }),
  )
  .parse(Deno.args);

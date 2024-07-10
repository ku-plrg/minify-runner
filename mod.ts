import { Command } from "https://deno.land/x/cliffy@v1.0.0-rc.3/command/mod.ts";
import { loadSwc, transform } from "~/minifier/swc.ts";
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
    switch (name) {
      case "swc":
        const swcModule = await loadSwc(semver);
        const config = JSON.parse(
          await Deno.readTextFile(new URL(".swcrc", import.meta.url)),
        ) as Config;
        const { code: output } = transform({
          code: file ? await Deno.readTextFile(codeOrFilePath) : codeOrFilePath,
          config,
          filename: "tmp.js",
          swc: swcModule,
        });
        console.log(output.trim());
        return;
      default:
        throw "invalid minifier name";
    }
  })
  .parse(Deno.args);

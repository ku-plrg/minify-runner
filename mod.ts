import { Command } from "https://deno.land/x/cliffy@v1.0.0-rc.3/command/mod.ts";
import { loadSwc, transform } from "~/minifier/swc.ts";
import type { Config } from "https://esm.sh/v135/@swc/types@0.1.6";

await new Command()
  .name("minify-runner")
  .arguments("<name@semver:string> <code:string>")
  .action(async (_, nameWithSemver, code) => {
    const [name, semver] = nameWithSemver.split("@");
    switch (name) {
      case "swc":
        const swcModule = await loadSwc(semver);
        const config = JSON.parse(
          await Deno.readTextFile(new URL(".swcrc", import.meta.url)),
        ) as Config;
        const { code: output } = transform({
          code,
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

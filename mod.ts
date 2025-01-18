import { serve } from "https://deno.land/std/http/server.ts";
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

// Valid target values for SWC
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

// Helper function to process the command logic
async function processCommand(
  options: Record<string, any>,
  codeOrFilePath: string,
): Promise<string> {
  const { version, file, diff } = options;
  const [name, semver] = version.split("@");
  const code = file ? await Deno.readTextFile(codeOrFilePath) : codeOrFilePath;

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
              validJscTargetSwc.join(", ")
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
      if (diff) {
        const diffConfig = JSON.parse(
          await Deno.readTextFile(new URL(".acornrc", import.meta.url)),
        );
        const diffResult = await minifyCheck(code, output, diffConfig);
        return `${output.trim()}\n======================================\n${diffResult}`;
      }
      return output.trim();
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
      if (diff) {
        const diffConfig = JSON.parse(
          await Deno.readTextFile(new URL(".acornrc", import.meta.url)),
        );
        const diffResult = await minifyCheck(code, output, diffConfig);
        return `${output.trim()}\n======================================\n${diffResult}`;
      }
      return output.trim();
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
      if (diff) {
        const diffConfig = JSON.parse(
          await Deno.readTextFile(new URL(".acornrc", import.meta.url)),
        );
        const diffResult = await minifyCheck(code, output, diffConfig);
        return `${output.trim()}\n======================================\n${diffResult}`;
      }
      return output.trim();
    }
    default:
      throw new Error("Invalid minifier name");
  }
}

// Start the server
console.log("Server running at http://127.0.0.1:8282");
serve(async (req) => {
  try {
    const url = new URL(req.url, `http://${req.headers.get("host")}`);
    const commandParams = Object.fromEntries(url.searchParams.entries());

    const codeOrFilePath = commandParams.codeOrFilePath;
    if (!codeOrFilePath) {
      return new Response("Missing 'codeOrFilePath' parameter", {
        status: 400,
      });
    }

    const result = await processCommand(commandParams, codeOrFilePath);
    return new Response(result, { status: 200 });
  } catch (error) {
    console.error(error);
    if (error instanceof Error) {
      return new Response(error.message, { status: 500 });
    } else {
      return new Response(error as string, { status: 500 });
    }
  }
}, { port: 8282 });

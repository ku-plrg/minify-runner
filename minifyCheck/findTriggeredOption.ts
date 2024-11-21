import {
    load as loadSwc,
    SwcModule,
    transform as transformSwc,
} from "~/minifier/swc.ts";
import { Command } from "https://deno.land/x/cliffy@v1.0.0-rc.4/command/mod.ts";
import type { Config } from "https://esm.sh/v135/@swc/types@0.1.6";

export async function deltaDebugOptionSwc(
    code: string,
    config: any,
    swc: SwcModule,
    cliOption: any,
): Promise<any> {
    const triggeredOptions: string[] = [];
    const triggeredOptionsBruteForce: string[][] = [];

    let originalOutputTrimmed: string;

    try {
        originalOutputTrimmed = transformSwc({
            code,
            config,
            filename: "tmp.js",
            swc,
        }).code.trim();
    } catch (err) {
        console.log(
            `pass checking original output due to unexpected error: ${err}`,
        );
        return [];
    }

    const compressConfigKeys = Object.keys(config.jsc?.minify?.compress ?? {})
        .filter((key) => typeof config.jsc.minify.compress[key] === "boolean");

    const originalConfig = { ...config.jsc.minify.compress };

    if (cliOption["brute-force"]) {
        const compressConfigKeysLength = compressConfigKeys.length;

        for (let i = 0; i < 2 << compressConfigKeysLength; i++) {
            for (let j = 0; j < compressConfigKeysLength; j++) {
                const key = compressConfigKeys[j];
                config.jsc.minify.compress[key] = Boolean(i & (1 << j));
            }

            try {
                const newOutputTrimmed = transformSwc({
                    code,
                    config,
                    filename: "tmp.js",
                    swc,
                }).code.trim();
                if (originalOutputTrimmed !== newOutputTrimmed) {
                    triggeredOptionsBruteForce.push(
                        compressConfigKeys.filter((key) =>
                            originalConfig[key] !==
                                config.jsc.minify.compress[key]
                        ),
                    );
                }
            } catch (err) {
                console.log(`pass due to unexpected error: ${err}`);
            }
        }

        return triggeredOptionsBruteForce;
    } else {
        for (const key of compressConfigKeys) {
            if (key.startsWith("unsafe") && !cliOption.unsafe) {
                continue;
            }

            const originalConfigValue = config.jsc.minify.compress[key];

            config.jsc.minify.compress[key] = !originalConfigValue;

            try {
                const newOutputTrimmed = transformSwc({
                    code,
                    config,
                    filename: "tmp.js",
                    swc,
                }).code.trim();
                if (originalOutputTrimmed !== newOutputTrimmed) {
                    triggeredOptions.push(key);
                }
            } catch (err) {
                console.log(`pass due to unexpected error: ${err}`);
            } finally {
                config.jsc.minify.compress[key] = originalConfigValue;
            }
        }

        return triggeredOptions;
    }
}

export const findTriggeredOptionsCommand = new Command()
    .name("find-triggered-options")
    .description(
        "Check triggered minifying options and generate a summary file",
    )
    .option("-o, --output <output:string>", "Output summary file", {
        default: "summary.json",
    })
    .option("-u, --unsafe", "Enable checking unsafe options", {
        default: false,
    })
    .option("-b, --bruteforce", "Enable brute-force mode", {
        default: false,
    })
    .arguments("<paths...:string>")
    .action(
        async (
            options: {
                output: string;
                unsafe: boolean;
                bruteforce: boolean;
            },
            ...paths: string[]
        ) => {
            console.log("Finding triggered options...");
            const files = await collectJavaScriptFiles(paths);
            console.log(`Found ${files.length} JavaScript files`);
            const swc = await loadSwc("1.4.6");
            const config = JSON.parse(
                await Deno.readTextFile(new URL("../.swcrc", import.meta.url)),
            ) as Config;
            const summary: Record<string, string[]> = {};

            for (const file of files) {
                console.log(`Checking ${file}`);
                const code = await Deno.readTextFile(file);
                const triggeredOptions = await deltaDebugOptionSwc(
                    code,
                    config,
                    swc,
                    {
                        "unsafe": options.unsafe,
                        "brute-force": options.bruteforce,
                    },
                );
                summary[file] = triggeredOptions;
            }

            await Deno.writeTextFile(
                options.output,
                JSON.stringify(summary, null, 2),
            );
            console.log(`Summary saved to ${options.output}`);
        },
    );

async function collectJavaScriptFiles(paths: string[]): Promise<string[]> {
    const files: string[] = [];
    for (const path of paths) {
        const stat = await Deno.stat(path);
        if (stat.isFile && path.endsWith(".js")) {
            files.push(path);
        } else if (stat.isDirectory) {
            for await (const entry of Deno.readDir(path)) {
                const entryPath = `${path}/${entry.name}`;
                if (entry.isFile && entry.name.endsWith(".js")) {
                    files.push(entryPath);
                } else if (entry.isDirectory) {
                    paths.push(entryPath);
                }
            }
        }
    }
    return files;
}

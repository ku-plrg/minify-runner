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
            const files = [];
            for await (const file of collectJavaScriptFiles(paths)) {
                files.push(file);
            }
            console.log(`Found ${files.length} JavaScript files`);
            const swc = await loadSwc("1.4.6");
            const config = JSON.parse(
                await Deno.readTextFile(new URL("../.swcrc", import.meta.url)),
            ) as Config;

            // 출력 파일을 쓰기 스트림으로 열기
            const outputFile = await Deno.open(options.output, {
                write: true,
                create: true,
                truncate: true,
            });

            // JSON 배열의 시작 부분 쓰기
            await outputFile.write(new TextEncoder().encode("{\n"));

            let isFirst = true;
            let checkedFiles = 0;
            const batchSize = 100; // 한 번에 처리할 파일 수
            let batchResults = [];

            for await (const file of collectJavaScriptFiles(paths)) {
                checkedFiles++;
                console.log(`Checking ${file}`);
                if (checkedFiles % 1000 === 0) {
                    console.log(`Checked ${checkedFiles} files`);
                }
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

                // JSON 형태로 결과를 문자열로 변환
                const summaryEntry = JSON.stringify(triggeredOptions, null, 2);

                // 결과를 배치에 추가
                batchResults.push(`  "${file}": ${summaryEntry}`);

                // 배치 크기만큼 처리했으면 출력 파일에 기록
                if (batchResults.length >= batchSize) {
                    if (!isFirst) {
                        await outputFile.write(new TextEncoder().encode(",\n"));
                    } else {
                        isFirst = false;
                    }
                    await outputFile.write(
                        new TextEncoder().encode(batchResults.join(",\n")),
                    );
                    batchResults = [];
                }
            }

            // 남은 결과 기록
            if (batchResults.length > 0) {
                if (!isFirst) {
                    await outputFile.write(new TextEncoder().encode(",\n"));
                }
                await outputFile.write(
                    new TextEncoder().encode(batchResults.join(",\n")),
                );
            }

            // JSON 객체의 끝 부분 쓰기
            await outputFile.write(new TextEncoder().encode("\n}\n"));

            // 출력 파일 닫기
            outputFile.close();

            console.log(`Summary saved to ${options.output}`);
        },
    );

async function* collectJavaScriptFiles(
    paths: string[],
    visited = new Set<string>(),
): AsyncGenerator<string> {
    for (const path of paths) {
        if (visited.has(path)) {
            continue; // Skip already visited paths to avoid infinite recursion
        }
        visited.add(path);

        const stat = await Deno.stat(path);
        if (stat.isFile && path.endsWith(".js")) {
            yield path;
        } else if (stat.isDirectory) {
            for await (const entry of Deno.readDir(path)) {
                const entryPath = `${path}/${entry.name}`;
                if (entry.isFile && entry.name.endsWith(".js")) {
                    yield entryPath;
                } else if (entry.isDirectory) {
                    yield* collectJavaScriptFiles([entryPath], visited);
                }
            }
        }
    }
}

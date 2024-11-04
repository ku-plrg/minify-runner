import { Options, parse, Program } from "https://esm.sh/acorn@8.14.0";

// Parse JavaScript code to generate AST
export async function parseArcon(
    code: string,
    config: Options,
): Promise<Program> {
    const ast: Program = parse(code.trim(), config);
    return ast;
}

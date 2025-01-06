import { Node, Options, Program } from "https://esm.sh/acorn@8.14.0";
import { parseArcon } from "./parse.ts";

// ignoring lexical informations
const ignoringTypes = [
    "Identifier",
    "Literal",
    "TemplateElement",
];

export async function minifyCheck(
    original: string,
    minified: string,
    config: Options,
): Promise<boolean> {
    // if original starts with "use strict", minified should also start with "use strict": if not, add "use strict" to minified

    let originalStrict = original.trim().startsWith('"use strict"') ||
        original.trim().startsWith("'use strict'");
    let minifiedStrict = minified.trim().startsWith('"use strict"') ||
        minified.trim().startsWith("'use strict'");
    if (originalStrict && !minifiedStrict) {
        minified = '"use strict";\n' + minified;
    } else if (!originalStrict && minifiedStrict) {
        original = '"use strict";\n' + original;
    }

    const originalAst = await parseArcon(original, config);
    const minifiedAst = await parseArcon(minified, config);

    return compareASTsByType(originalAst, minifiedAst);
}

export async function minifyCheckWithMinfying(
    original: string,
    config: Options,
): Promise<boolean> {
    let minified = ""; // to be implemented
    return minifyCheck(original, minified, config);
}

// compare ASTs to check if minified
// true if minified
function compareASTsByType(ast1: any, ast2: any): boolean {
    if (isLexicalNode(ast1) && isLexicalNode(ast2)) {
        return false;
    } else if (isLexicalNode(ast1) || isLexicalNode(ast2)) {
        return true;
    }

    if (Array.isArray(ast1) && Array.isArray(ast2)) {
        if (ast1.length !== ast2.length) {
            return true;
        }
        for (let i = 0; i < ast1.length; i++) {
            if (compareASTsByType(ast1[i], ast2[i])) {
                return true;
            }
        }
        return false;
    } else if (
        ast1 && ast2 && typeof ast1 === "string" && typeof ast2 === "string"
    ) {
        return ast1 !== ast2;
    } else if (
        ast1 && typeof ast1 === "object" && ast2 && typeof ast2 === "object"
    ) {
        if (ast1.type !== ast2.type) {
            return true;
        }
        const keys1 = Object.keys(ast1).filter((key) =>
            key !== "start" && key !== "end" && key !== "range" && key !== "loc"
        );
        const keys2 = Object.keys(ast2).filter((key) =>
            key !== "start" && key !== "end" && key !== "range" && key !== "loc"
        );
        if (keys1.length !== keys2.length) return true;

        keys1.sort();
        keys2.sort();

        for (let i = 0; i < keys1.length; i++) {
            if (keys1[i] !== keys2[i]) return true;
        }

        for (const key of keys1) {
            if (compareASTsByType(ast1[key], ast2[key])) return true;
        }
        return false;
    } else {
        return ast1 && ast2 && ast1.type !== ast2.type;
    }
}

function isLexicalNode(node: any): boolean {
    return node && ignoringTypes.includes(node.type);
}

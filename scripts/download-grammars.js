#!/usr/bin/env node
/**
 * Downloads tree-sitter WASM grammar files into node_modules/web-tree-sitter/grammars/.
 * Run automatically via postinstall. Skips gracefully if grammars already exist.
 *
 * Source: tree-sitter-wasms package on unpkg (mirrors npm registry artifacts).
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const TREE_SITTER_WASMS_VERSION = "0.1.13";
const BASE_URL = `https://unpkg.com/tree-sitter-wasms@${TREE_SITTER_WASMS_VERSION}/out`;
const GRAMMAR_SHA256 = {
    "tree-sitter-typescript.wasm": "8515404dceed38e1ed86aa34b09fcf3379fff1b4ff9dd3967bcd6d1eb5ac3d8f",
    "tree-sitter-tsx.wasm": "6aa3b2c70e76f5d48eafef1093e9c4de383e13f2fdde2f4e9b98a378f6a8f1b6",
    "tree-sitter-javascript.wasm": "63812b9e275d26851264734868d27a1656bd44a2ef6eb3e85e6b03728c595ab5",
    "tree-sitter-python.wasm": "9056d0fb0c337810d019fae350e8167786119da98f0f282aceae7ab89ee8253b",
    "tree-sitter-rust.wasm": "4409921a70d0aa5bec7d1d7ce809a557a8ee1cf6ace901e3ac6a76e62cfea903",
    "tree-sitter-go.wasm": "9963ca89b616eaf04b08a43bc1fb0f07b85395bec313330851f1f1ead2f755b6",
    "tree-sitter-java.wasm": "637aac4415fb39a211a4f4292d63c66b5ce9c32fa2cd35464af4f681d91b9a1f",
    "tree-sitter-kotlin.wasm": "b5cb00c8d06ed0f10f1dbe497205b437809d7e87db1f638721a8cfb30e044449",
    "tree-sitter-dart.wasm": "7f5364e4256cf7e55efd01dd52421ef2663caa8061b82659b7e4bf61064545ec",
    "tree-sitter-c.wasm": "056b25072382f72deee2c64ec238ffc4bb8cf42844ef21502c0e70f03a8a0d66",
    "tree-sitter-cpp.wasm": "f6afdf53bfd6de76557bb7edb624a3a3869e14d9a83b78433f93617ecee42527",
    "tree-sitter-elixir.wasm": "82e91b9759ddca30d8978ebbfa8e347b4451b64c931f9ae62112e6db9b8fac20",
    "tree-sitter-ruby.wasm": "93a5022855314cdb45458c7bb026a24a0ebc3a5ff6439e542e881f14dfa13a39",
};
const GRAMMARS = Object.keys(GRAMMAR_SHA256);
function findGrammarsDir() {
    const scriptDir = dirname(fileURLToPath(import.meta.url));
    const pkgRoot = dirname(scriptDir);
    // Prefer local node_modules next to this package
    return join(pkgRoot, "node_modules", "web-tree-sitter", "grammars");
}
async function downloadGrammar(destDir, filename) {
    const dest = join(destDir, filename);
    if (existsSync(dest)) {
        console.log(`  skip  ${filename} (already exists)`);
        return;
    }
    const url = `${BASE_URL}/${filename}`;
    const res = await fetch(url);
    if (!res.ok)
        throw new Error(`HTTP ${res.status} fetching ${url}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const digest = createHash("sha256").update(buf).digest("hex");
    if (digest !== GRAMMAR_SHA256[filename]) {
        throw new Error(`sha256 mismatch for ${filename}: expected ${GRAMMAR_SHA256[filename]}, got ${digest}`);
    }
    writeFileSync(dest, buf);
    console.log(`  ok    ${filename}`);
}
async function main() {
    if (process.env.PI_LENS_DOWNLOAD_GRAMMARS !== "1") {
        console.log("Skipping tree-sitter grammar download (set PI_LENS_DOWNLOAD_GRAMMARS=1 to opt in).");
        return;
    }
    const grammarsDir = findGrammarsDir();
    if (!existsSync(grammarsDir)) {
        mkdirSync(grammarsDir, { recursive: true });
    }
    console.log(`Downloading tree-sitter grammars → ${grammarsDir}`);
    const results = await Promise.allSettled(GRAMMARS.map((g) => downloadGrammar(grammarsDir, g)));
    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length > 0) {
        for (const f of failed) {
            console.warn("  warn ", f.reason?.message);
        }
        throw new Error(`${failed.length} grammar(s) failed — tree-sitter analysis may be unavailable.`);
    }
    else {
        console.log("All grammars downloaded successfully.");
    }
}
main().catch((err) => {
    console.warn("Warning: grammar download failed:", err.message);
    process.exit(1);
});

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { applyWorkspaceEdit } from "../../../clients/lsp/edits.js";

describe("applyWorkspaceEdit containment", () => {
	it("applies file URI text edits inside the workspace", async () => {
		const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "pi-lens-lsp-edits-"));
		try {
			const file = path.join(cwd, "index.ts");
			fs.writeFileSync(file, "const oldName = 1;\n");

			await applyWorkspaceEdit(
				{
					changes: {
						[pathToFileURL(file).href]: [
							{
								range: {
									start: { line: 0, character: 6 },
									end: { line: 0, character: 13 },
								},
								newText: "newName",
							},
						],
					},
				},
				cwd,
			);

			expect(fs.readFileSync(file, "utf-8")).toBe("const newName = 1;\n");
		} finally {
			fs.rmSync(cwd, { recursive: true, force: true });
		}
	});

	it("rejects workspace edits that target files outside the workspace", async () => {
		const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "pi-lens-lsp-edits-"));
		const outside = path.join(os.tmpdir(), `pi-lens-outside-${Date.now()}.ts`);
		try {
			fs.writeFileSync(outside, "const untouched = 1;\n");

			await expect(
				applyWorkspaceEdit(
					{
						changes: {
							[pathToFileURL(outside).href]: [
								{
									range: {
										start: { line: 0, character: 6 },
										end: { line: 0, character: 15 },
									},
									newText: "modified",
								},
							],
						},
					},
					cwd,
				),
			).rejects.toThrow(/escapes workspace/);

			expect(fs.readFileSync(outside, "utf-8")).toBe("const untouched = 1;\n");
		} finally {
			fs.rmSync(cwd, { recursive: true, force: true });
			fs.rmSync(outside, { force: true });
		}
	});
});

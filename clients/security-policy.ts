import path from "node:path";
import { isUnderDir } from "./path-utils.js";

function flagEnabled(name: string): boolean {
	const value = process.env[name]?.trim().toLowerCase();
	return value === "1" || value === "true" || value === "yes" || value === "on";
}

/**
 * One explicit escape hatch for trusted local development. Security-sensitive
 * repo-controlled execution remains off by default for untrusted workspaces.
 */
export function isWorkspaceTrusted(): boolean {
	return flagEnabled("PI_LENS_TRUST_WORKSPACE");
}

export function allowRepoLSPCommands(): boolean {
	return isWorkspaceTrusted() || flagEnabled("PI_LENS_ALLOW_REPO_LSP_COMMANDS");
}

export function allowProjectLocalTools(): boolean {
	return isWorkspaceTrusted() || flagEnabled("PI_LENS_ALLOW_PROJECT_LOCAL_TOOLS");
}

export function allowLegacyProjectDataDir(): boolean {
	return isWorkspaceTrusted() || flagEnabled("PI_LENS_ALLOW_LEGACY_PROJECT_DATA_DIR");
}

export function allowFullToolEnvironment(): boolean {
	return isWorkspaceTrusted() || flagEnabled("PI_LENS_ALLOW_FULL_TOOL_ENV");
}

export function allowUnpinnedPackageInstalls(): boolean {
	return isWorkspaceTrusted() || flagEnabled("PI_LENS_ALLOW_UNPINNED_INSTALLS");
}

export function allowUnverifiedGitHubInstalls(): boolean {
	return isWorkspaceTrusted() || flagEnabled("PI_LENS_ALLOW_UNVERIFIED_GITHUB_INSTALLS");
}

export function allowPostinstallGrammarDownload(): boolean {
	return flagEnabled("PI_LENS_DOWNLOAD_GRAMMARS");
}

const SAFE_ENV_ALLOWLIST = new Set([
	"CI",
	"COLORTERM",
	"COMSPEC",
	"HOME",
	"HOMEDRIVE",
	"HOMEPATH",
	"LANG",
	"LC_ALL",
	"LOCALAPPDATA",
	"LOGNAME",
	"PATH",
	"Path",
	"path",
	"PATHEXT",
	"ProgramData",
	"ProgramFiles",
	"ProgramFiles(x86)",
	"PROGRAMW6432",
	"PWD",
	"SHELL",
	"SystemDrive",
	"SystemRoot",
	"TEMP",
	"TERM",
	"TMP",
	"TMPDIR",
	"USER",
	"USERNAME",
	"USERPROFILE",
	"VIRTUAL_ENV",
	"CONDA_PREFIX",
	"WINDIR",
]);

const SENSITIVE_ENV_RE =
	/(TOKEN|KEY|SECRET|PASSWORD|PASSWD|PWD|CREDENTIAL|AUTH|COOKIE|SESSION|PRIVATE|CERT|SSH_AUTH_SOCK|GITHUB_|GITLAB_|NPM_|AWS_|AZURE_|GOOGLE_|GCP_|OPENAI_|ANTHROPIC_|FIREWORKS_|GEMINI_|DATABASE_URL|PGPASSWORD)/i;

export function buildToolEnvironment(
	overrides?: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
	if (allowFullToolEnvironment()) {
		return { ...process.env, ...overrides };
	}

	const env: NodeJS.ProcessEnv = {};
	for (const [key, value] of Object.entries(process.env)) {
		if (value === undefined) continue;
		if (SAFE_ENV_ALLOWLIST.has(key) && !SENSITIVE_ENV_RE.test(key)) {
			env[key] = value;
		}
	}

	for (const [key, value] of Object.entries(overrides ?? {})) {
		if (value === undefined) continue;
		if (SENSITIVE_ENV_RE.test(key) && !SAFE_ENV_ALLOWLIST.has(key)) continue;
		env[key] = value;
	}

	return env;
}

export function isExactPackageSpecifier(packageName: string): boolean {
	// npm scoped names contain one @ as their first character; exact versions need
	// another @ after the package path. Unscoped packages need any @version suffix.
	if (packageName.startsWith("@")) {
		return packageName.indexOf("@", 1) > 1;
	}
	return packageName.includes("@");
}

export function isPathInsideWorkspace(filePath: string, cwd: string): boolean {
	const resolved = path.resolve(filePath);
	const root = path.resolve(cwd);
	return isUnderDir(resolved, root);
}

export function isProjectLocalPath(filePath: string, cwd: string): boolean {
	const resolved = path.resolve(filePath);
	const root = path.resolve(cwd);
	return isUnderDir(resolved, root);
}

export function redactForPersistentLog(value: string, maxLength = 240): string {
	let redacted = value
		.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[redacted-email]")
		.replace(/\b(?:sk|pk|ghp|gho|ghu|github_pat|xox[baprs])-?[A-Za-z0-9_\-]{16,}\b/g, "[redacted-token]")
		.replace(/\b[A-Za-z0-9_\-]{32,}\b/g, "[redacted-long-token]")
		.replace(/(api[_-]?key|token|secret|password|passwd)\s*[:=]\s*[^\s,;]+/gi, "$1=[redacted]");
	if (redacted.length > maxLength) redacted = `${redacted.slice(0, maxLength)}…`;
	return redacted;
}

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const rootDir = join(import.meta.dirname, "..");

type BumpType = "major" | "minor" | "patch";

function parseVersion(version: string): [number, number, number] {
	const parts = version.split(".").map(Number);
	if (parts.length !== 3 || parts.some(isNaN)) {
		throw new Error(`Invalid version format: ${version}`);
	}
	return parts as [number, number, number];
}

function bumpVersion(version: string, type: BumpType): string {
	const [major, minor, patch] = parseVersion(version);

	switch (type) {
		case "major":
			return `${major + 1}.0.0`;
		case "minor":
			return `${major}.${minor + 1}.0`;
		case "patch":
			return `${major}.${minor}.${patch + 1}`;
	}
}

const VERSION_COMMENT =
	"# Do not edit manually. Use: bun run bump <major|minor|patch>";

function updateVersionFile(newVersion: string): void {
	const filePath = join(rootDir, "VERSION");
	writeFileSync(filePath, `${VERSION_COMMENT}\n${newVersion}\n`);
	console.log(`Updated VERSION to ${newVersion}`);
}

function updatePackageJson(newVersion: string): void {
	const filePath = join(rootDir, "package.json");
	const content = JSON.parse(readFileSync(filePath, "utf-8"));
	content.version = newVersion;
	writeFileSync(filePath, `${JSON.stringify(content, null, "\t")}\n`);
	console.log(`Updated package.json to ${newVersion}`);
}

function updateTauriConf(newVersion: string): void {
	const filePath = join(rootDir, "src-tauri", "tauri.conf.json");
	const content = JSON.parse(readFileSync(filePath, "utf-8"));
	content.version = newVersion;
	writeFileSync(filePath, `${JSON.stringify(content, null, "\t")}\n`);
	console.log(`Updated tauri.conf.json to ${newVersion}`);
}

function updateCargoToml(newVersion: string): void {
	const filePath = join(rootDir, "src-tauri", "Cargo.toml");
	let content = readFileSync(filePath, "utf-8");

	// Update only the package version (first occurrence)
	content = content.replace(/^(version\s*=\s*)"[^"]+"/m, `$1"${newVersion}"`);

	writeFileSync(filePath, content);
	console.log(`Updated Cargo.toml to ${newVersion}`);
}

function getCurrentVersion(): string {
	const filePath = join(rootDir, "VERSION");
	const content = readFileSync(filePath, "utf-8");
	// Skip comment lines (starting with #)
	const versionLine = content
		.split("\n")
		.find((line) => line.trim() && !line.startsWith("#"));
	if (!versionLine) {
		throw new Error("No version found in VERSION file");
	}
	return versionLine.trim();
}

function main(): void {
	const args = process.argv.slice(2);
	const bumpType = args[0] as BumpType | undefined;

	if (!bumpType || !["major", "minor", "patch"].includes(bumpType)) {
		console.error("Usage: bun run bump <major|minor|patch>");
		console.error("  major: 1.0.0 -> 2.0.0");
		console.error("  minor: 1.0.0 -> 1.1.0");
		console.error("  patch: 1.0.0 -> 1.0.1");
		process.exit(1);
	}

	const currentVersion = getCurrentVersion();
	const newVersion = bumpVersion(currentVersion, bumpType);

	console.log(`Bumping version: ${currentVersion} -> ${newVersion}\n`);

	updateVersionFile(newVersion);
	updatePackageJson(newVersion);
	updateTauriConf(newVersion);
	updateCargoToml(newVersion);

	console.log(`\nVersion bumped to ${newVersion}`);
}

main();

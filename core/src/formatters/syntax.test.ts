import { describe, expect, test } from "bun:test";
import { getLanguageForExtension } from "./syntax.js";

describe("getLanguageForExtension", () => {
	describe("JavaScript/TypeScript", () => {
		test("maps TypeScript extensions", () => {
			expect(getLanguageForExtension("ts")).toBe("typescript");
			expect(getLanguageForExtension("tsx")).toBe("tsx");
		});

		test("maps JavaScript extensions", () => {
			expect(getLanguageForExtension("js")).toBe("javascript");
			expect(getLanguageForExtension("jsx")).toBe("jsx");
		});
	});

	describe("Common languages", () => {
		test("maps Python", () => {
			expect(getLanguageForExtension("py")).toBe("python");
		});

		test("maps Ruby", () => {
			expect(getLanguageForExtension("rb")).toBe("ruby");
		});

		test("maps Go", () => {
			expect(getLanguageForExtension("go")).toBe("go");
		});

		test("maps Rust", () => {
			expect(getLanguageForExtension("rs")).toBe("rust");
		});

		test("maps Java", () => {
			expect(getLanguageForExtension("java")).toBe("java");
		});

		test("maps Kotlin", () => {
			expect(getLanguageForExtension("kt")).toBe("kotlin");
		});

		test("maps Swift", () => {
			expect(getLanguageForExtension("swift")).toBe("swift");
		});
	});

	describe("C family", () => {
		test("maps C extensions", () => {
			expect(getLanguageForExtension("c")).toBe("c");
			expect(getLanguageForExtension("h")).toBe("c");
		});

		test("maps C++ extensions", () => {
			expect(getLanguageForExtension("cpp")).toBe("cpp");
			expect(getLanguageForExtension("hpp")).toBe("cpp");
		});

		test("maps C#", () => {
			expect(getLanguageForExtension("cs")).toBe("csharp");
		});
	});

	describe("Web & scripting", () => {
		test("maps PHP", () => {
			expect(getLanguageForExtension("php")).toBe("php");
		});

		test("maps shell scripts", () => {
			expect(getLanguageForExtension("sh")).toBe("bash");
			expect(getLanguageForExtension("bash")).toBe("bash");
			expect(getLanguageForExtension("zsh")).toBe("zsh");
			expect(getLanguageForExtension("fish")).toBe("fish");
		});

		test("maps PowerShell", () => {
			expect(getLanguageForExtension("ps1")).toBe("powershell");
		});
	});

	describe("Data formats", () => {
		test("maps JSON", () => {
			expect(getLanguageForExtension("json")).toBe("json");
		});

		test("maps YAML", () => {
			expect(getLanguageForExtension("yaml")).toBe("yaml");
			expect(getLanguageForExtension("yml")).toBe("yaml");
		});

		test("maps TOML", () => {
			expect(getLanguageForExtension("toml")).toBe("toml");
		});

		test("maps XML", () => {
			expect(getLanguageForExtension("xml")).toBe("xml");
		});
	});

	describe("Stylesheets", () => {
		test("maps HTML", () => {
			expect(getLanguageForExtension("html")).toBe("html");
		});

		test("maps CSS", () => {
			expect(getLanguageForExtension("css")).toBe("css");
		});

		test("maps SCSS", () => {
			expect(getLanguageForExtension("scss")).toBe("scss");
		});

		test("maps LESS", () => {
			expect(getLanguageForExtension("less")).toBe("less");
		});
	});

	describe("Query & config", () => {
		test("maps SQL", () => {
			expect(getLanguageForExtension("sql")).toBe("sql");
		});

		test("maps Markdown", () => {
			expect(getLanguageForExtension("md")).toBe("markdown");
			expect(getLanguageForExtension("mdx")).toBe("mdx");
		});

		test("maps GraphQL", () => {
			expect(getLanguageForExtension("graphql")).toBe("graphql");
			expect(getLanguageForExtension("gql")).toBe("graphql");
		});

		test("maps Protocol Buffers", () => {
			expect(getLanguageForExtension("proto")).toBe("protobuf");
		});

		test("maps Terraform/HCL", () => {
			expect(getLanguageForExtension("tf")).toBe("hcl");
			expect(getLanguageForExtension("hcl")).toBe("hcl");
		});
	});

	describe("Edge cases", () => {
		test("handles extensions with leading dot", () => {
			expect(getLanguageForExtension(".ts")).toBe("typescript");
			expect(getLanguageForExtension(".js")).toBe("javascript");
			expect(getLanguageForExtension(".py")).toBe("python");
		});

		test("is case-insensitive", () => {
			expect(getLanguageForExtension("TS")).toBe("typescript");
			expect(getLanguageForExtension("Js")).toBe("javascript");
			expect(getLanguageForExtension("PY")).toBe("python");
		});

		test("returns 'text' for unknown extensions", () => {
			expect(getLanguageForExtension("unknown")).toBe("text");
			expect(getLanguageForExtension("xyz")).toBe("text");
			expect(getLanguageForExtension("")).toBe("text");
		});
	});
});

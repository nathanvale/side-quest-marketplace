import { afterEach, describe, expect, it } from "bun:test";
import {
	createTestVault,
	useTestVaultCleanup,
	writeVaultFile,
} from "../testing/utils";
import { discoverAttachments } from "./index";

describe("discoverAttachments", () => {
	const { trackVault, getAfterEachHook } = useTestVaultCleanup();
	afterEach(getAfterEachHook());

	it("finds sibling assets folders and stem files", () => {
		const vault = createTestVault();
		trackVault(vault);
		writeVaultFile(vault, "note.md", "body");
		writeVaultFile(vault, "assets/image.png", "data");
		writeVaultFile(vault, "note.png", "data");

		const found = discoverAttachments(vault, "note.md");
		expect(found).toContain("assets/image.png");
		expect(found).toContain("note.png");
	});
});

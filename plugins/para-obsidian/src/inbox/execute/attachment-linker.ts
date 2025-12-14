/**
 * Attachment Link Injection
 *
 * Handles injecting attachment links into notes:
 * - Inject into Attachments section
 * - Create section if missing
 * - Handle errors gracefully (non-fatal)
 *
 * @module inbox/execute/attachment-linker
 */

import { readTextFileSync, writeTextFileSync } from "@sidequest/core/fs";
import { loadConfig } from "../../config/index";
import { injectSections } from "../../notes/create";
import { resolveVaultPath } from "../../shared/fs";
import type { executeLogger } from "../../shared/logger";
import type { AttachmentLinkResult } from "./types";

/**
 * Inject an attachment link into a note's Attachments section.
 *
 * Steps:
 * 1. Try to inject using injectSections (looks for ## Attachments)
 * 2. If section doesn't exist, create it at end of file
 * 3. Log warnings but don't fail (attachment move succeeded)
 *
 * @param notePath - Vault-relative path to note
 * @param attachmentPath - Vault-relative path to attachment
 * @param logger - Optional logger instance
 * @param cid - Correlation ID for logging
 * @returns Result with success flag and warnings
 */
export async function injectAttachmentLink(
	notePath: string,
	attachmentPath: string,
	logger: typeof executeLogger,
	cid: string,
): Promise<AttachmentLinkResult> {
	try {
		const paraConfig = loadConfig();
		const attachmentWikilink = `![[${attachmentPath}]]`;

		const injectionResult = injectSections(paraConfig, notePath, {
			Attachments: attachmentWikilink,
		});

		if (injectionResult.injected.length > 0) {
			if (logger) {
				logger.info`Injected attachment link into section=Attachments ${cid}`;
			}
			return { success: true };
		}

		// Section doesn't exist - append to end of file
		if (injectionResult.skipped.length > 0) {
			if (logger) {
				logger.warn`No Attachments section found - appending to end of file ${cid}`;
			}

			const target = resolveVaultPath(paraConfig.vault, notePath);
			const content = readTextFileSync(target.absolute);
			const updatedContent = `${content.trimEnd()}\n\n## Attachments\n\n${attachmentWikilink}\n`;
			writeTextFileSync(target.absolute, updatedContent);

			if (logger) {
				logger.info`Created Attachments section and added link ${cid}`;
			}

			return {
				success: true,
				warnings: ["Created Attachments section (did not exist)"],
			};
		}

		return { success: true };
	} catch (error) {
		const errorMsg = `Failed to inject attachment link: ${error instanceof Error ? error.message : "unknown"}`;
		if (logger) {
			logger.warn`${errorMsg} ${cid}`;
		}
		return {
			success: false,
			error: errorMsg,
		};
	}
}

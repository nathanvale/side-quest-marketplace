/**
 * Gmail email sending functionality.
 *
 * Sends HTML emails to self using Gmail API.
 * Used to deliver cinema ticket confirmations.
 */

import { google } from "googleapis";
import { getAuthenticatedClient } from "./auth";
import { GmailSendError } from "./types";

/**
 * Email message structure.
 */
export interface EmailMessage {
	to: string;
	subject: string;
	htmlBody: string;
}

/**
 * Encodes email message in RFC 2822 format for Gmail API.
 *
 * Gmail API requires messages in base64url-encoded RFC 2822 format.
 *
 * @param message - Email message to encode
 * @returns Base64url-encoded email string
 */
function encodeMessage(message: EmailMessage): string {
	const lines = [
		`To: ${message.to}`,
		"Content-Type: text/html; charset=utf-8",
		"MIME-Version: 1.0",
		`Subject: ${message.subject}`,
		"",
		message.htmlBody,
	];

	const email = lines.join("\r\n");
	const encoded = Buffer.from(email).toString("base64");

	// Gmail API requires base64url encoding (- and _ instead of + and /)
	return encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Sends an HTML email using Gmail API.
 *
 * Authenticates with Gmail API and sends HTML email to specified recipient.
 * Typically used to send cinema ticket confirmations to self.
 *
 * @param message - Email message with recipient, subject, and HTML body
 * @returns Gmail API response with message ID
 * @throws {GmailSendError} If email fails to send
 *
 * @example
 * ```typescript
 * await sendEmail({
 *   to: "nathan@example.com",
 *   subject: "Booking Confirmation for Wicked",
 *   htmlBody: "<html>...</html>"
 * });
 * ```
 */
export async function sendEmail(message: EmailMessage): Promise<string> {
	try {
		const auth = await getAuthenticatedClient();
		const gmail = google.gmail({ version: "v1", auth });

		const encodedMessage = encodeMessage(message);

		const response = await gmail.users.messages.send({
			userId: "me",
			requestBody: {
				raw: encodedMessage,
			},
		});

		if (!response.data.id) {
			throw new GmailSendError(
				"Gmail API returned no message ID",
				"SEND_FAILED",
			);
		}

		return response.data.id;
	} catch (error) {
		if (error instanceof GmailSendError) {
			throw error;
		}

		throw new GmailSendError(`Failed to send email: ${error}`, "SEND_FAILED");
	}
}

/**
 * Sends a cinema ticket confirmation email to self.
 *
 * Convenience wrapper around sendEmail() for ticket confirmations.
 *
 * @param toEmail - Recipient email (typically Nathan's email)
 * @param movieTitle - Movie title for subject line
 * @param ticketHtml - HTML ticket content
 * @returns Gmail message ID
 */
export async function sendTicketEmail(
	toEmail: string,
	movieTitle: string,
	ticketHtml: string,
): Promise<string> {
	return sendEmail({
		to: toEmail,
		subject: `Booking Confirmation for ${movieTitle}`,
		htmlBody: ticketHtml,
	});
}

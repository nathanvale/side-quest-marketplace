/**
 * Cinema ticket email template generator
 *
 * Generates HTML email content for cinema tickets using the Classic Cinemas template.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { formatTicketTypeName } from "./price-scraper.ts";

/**
 * Ticket line item for invoice
 */
export interface TicketLine {
	/**
	 * Ticket type/description
	 * @example "Adult"
	 */
	type: string;

	/**
	 * Quantity of tickets
	 */
	quantity: number;
}

/**
 * Invoice line item
 */
export interface InvoiceLine {
	/**
	 * Item description
	 * @example "Adult x 2"
	 */
	description: string;

	/**
	 * Item price
	 * @example "$40.00"
	 */
	price: string;
}

/**
 * Data structure for cinema ticket information
 */
export interface TicketData {
	/**
	 * Customer's first name (not full name)
	 * @example "Nathan"
	 */
	customerName: string;

	/**
	 * Movie title exactly as shown on cinema website
	 */
	movieTitle: string;

	/**
	 * URL to movie poster image
	 */
	moviePoster: string;

	/**
	 * Session date and time
	 * @example "Fri 8 Nov, 06:15PM"
	 */
	sessionDateTime: string;

	/**
	 * Screen/cinema number
	 * @example "Screen 3"
	 */
	screenNumber: string;

	/**
	 * Comma-separated seat numbers
	 * @example "H12, H13"
	 */
	seats: string;

	/**
	 * List of ticket types and quantities
	 */
	tickets: TicketLine[];

	/**
	 * Booking reference number
	 * @example "CC123456"
	 */
	bookingNumber?: string;

	/**
	 * Invoice line items
	 */
	invoiceLines?: InvoiceLine[];

	/**
	 * Booking fee amount
	 * @example "$2.00"
	 */
	bookingFee?: string;

	/**
	 * Total amount including GST
	 * @example "$42.00"
	 */
	totalAmount?: string;

	/**
	 * URL to view booking in browser
	 */
	webViewUrl?: string;

	/**
	 * Barcode image URL
	 * If not provided, a placeholder barcode will be used
	 */
	barcodeUrl?: string;
}

/**
 * Default barcode image from Classic Cinemas (via Google image proxy)
 */
const DEFAULT_BARCODE =
	"https://ci3.googleusercontent.com/meips/ADKq_NaPR1UO0ABCDdjEmZOs7NnkHZe3ZB9YpKHGLyNCZXD0FH7h5UZJtQMgCD1Mn6jiareUCWODOHBZEfc1cWLPEXoxFYlSTfxxbYlc9PY9F8A=s0-d-e1-ft#https://www.classiccinemas.com.au/api/barcode/WHRT69C.jpg";

/**
 * List of template placeholder variables used in the email template
 */
export const TEMPLATE_PLACEHOLDERS = [
	"CUSTOMER_NAME",
	"MOVIE_TITLE",
	"MOVIE_IMAGE_URL",
	"SESSION_DATE_TIME",
	"SCREEN_NUMBER",
	"SEATS",
	"BARCODE_URL",
	"WEB_VIEW_URL",
	"BOOKING_NUMBER",
	"BOOKING_FEE",
	"TOTAL_AMOUNT",
	"TICKET_LINES",
	"INVOICE_LINES",
] as const;

/**
 * Generates HTML email content for a cinema ticket using the Classic Cinemas template
 *
 * Reads the email template file and replaces all {{PLACEHOLDER}} variables with
 * actual ticket data. The template is expected to be located at:
 * `plugins/the-cinema-bandit/classic-cinemas-email-template.html`
 *
 * @param data - Ticket information to populate in the template
 * @returns Complete HTML string ready for email delivery
 * @throws {Error} If template file cannot be read
 *
 * @example
 * ```typescript
 * const html = generateTicketHtml({
 *   customerName: "Nathan",
 *   movieTitle: "JIFF: Bad Shabbos",
 *   moviePoster: "https://example.com/poster.jpg",
 *   sessionDateTime: "Fri 29 Nov, 08:15PM",
 *   screenNumber: "Screen 3",
 *   seats: "H12, H13",
 *   tickets: [{ type: "Adult", quantity: 2 }],
 *   bookingNumber: "CC123456",
 *   invoiceLines: [{ description: "Adult x 2", price: "$40.00" }],
 *   bookingFee: "$2.00",
 *   totalAmount: "$42.00"
 * });
 * ```
 */
export function generateTicketHtml(data: TicketData): string {
	// Read the Classic Cinemas email template
	const templatePath = join(
		__dirname,
		"..",
		"classic-cinemas-email-template.html",
	);

	let template: string;
	try {
		template = readFileSync(templatePath, "utf-8");
	} catch (error) {
		throw new Error(
			`Failed to read email template at ${templatePath}: ${error instanceof Error ? error.message : String(error)}`,
		);
	}

	// Use defaults for optional fields
	const barcodeUrl = data.barcodeUrl ?? DEFAULT_BARCODE;
	const webViewUrl = data.webViewUrl ?? "#";
	const bookingNumber = data.bookingNumber ?? "N/A";
	const bookingFee = data.bookingFee ?? "$0.00";
	const totalAmount = data.totalAmount ?? "$0.00";

	// Replace all placeholders with actual data
	let html = template;

	// Basic fields
	html = html.replaceAll("{{CUSTOMER_NAME}}", escapeHtml(data.customerName));
	html = html.replaceAll("{{MOVIE_TITLE}}", escapeHtml(data.movieTitle));
	html = html.replaceAll("{{MOVIE_IMAGE_URL}}", data.moviePoster);
	html = html.replaceAll(
		"{{SESSION_DATE_TIME}}",
		escapeHtml(data.sessionDateTime),
	);
	html = html.replaceAll("{{SCREEN_NUMBER}}", escapeHtml(data.screenNumber));
	html = html.replaceAll("{{SEATS}}", escapeHtml(data.seats));
	html = html.replaceAll("{{BARCODE_URL}}", barcodeUrl);
	html = html.replaceAll("{{WEB_VIEW_URL}}", webViewUrl);
	html = html.replaceAll("{{BOOKING_NUMBER}}", escapeHtml(bookingNumber));
	html = html.replaceAll("{{BOOKING_FEE}}", escapeHtml(bookingFee));
	html = html.replaceAll("{{TOTAL_AMOUNT}}", escapeHtml(totalAmount));

	// Generate ticket lines HTML (format to match invoice style)
	const ticketLinesHtml = data.tickets
		.map(
			(
				ticket,
			) => `                                                                <tr>
                                                                    <td
                                                                            style="font-family: antwerp, sans-serif; font-size: 16px; line-height: 24px; color: #000000;">
                                                                    <span class="outlook-body-font">${escapeHtml(formatTicketTypeName(ticket.type))} x ${ticket.quantity}</span>
                                                                    </td>
                                                                </tr>`,
		)
		.join("\n");
	html = html.replaceAll("{{TICKET_LINES}}", ticketLinesHtml);

	// Generate invoice lines HTML
	const invoiceLinesHtml = data.invoiceLines
		? data.invoiceLines
				.map(
					(line) => `                            <tr>
                                <td
                                        style="font-family: antwerp, sans-serif; font-size: 14px; line-height: 14px; color: #414141;">
                                    <span class="outlook-body-font">${escapeHtml(line.description)}</span>
                                </td>
                                <td style="font-family: antwerp, sans-serif; font-size: 14px; line-height: 14px; color: #414141; text-align: right;">
                                    <span class="outlook-body-font">${escapeHtml(line.price)}</span>
                                </td>
                            </tr>
                            <tr class="no-print">
                                <td colspan="2" style="font-size: 0; padding-top: 2px; padding-bottom: 2px;">
                                    <p style="width: 100%; border-top: dashed 1px #000000; font-size: 1;">
                                        &nbsp;</p>
                                </td>
                            </tr>`,
				)
				.join("\n")
		: "";
	html = html.replaceAll("{{INVOICE_LINES}}", invoiceLinesHtml);

	return html;
}

/**
 * Escapes HTML special characters to prevent injection
 *
 * @param text - Text to escape
 * @returns HTML-safe text
 */
function escapeHtml(text: string): string {
	const htmlEscapeMap: Record<string, string> = {
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;",
		'"': "&quot;",
		"'": "&#39;",
	};

	return text.replace(/[&<>"']/g, (char) => htmlEscapeMap[char] ?? char);
}

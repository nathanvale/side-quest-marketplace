/**
 * Example usage of the ticket template generator
 *
 * Run with: bun run examples/generate-ticket-example.ts
 */

import { writeFileSync } from "node:fs";
import { generateTicketHtml, type TicketData } from "../src/template.js";

// Example ticket data
const sampleTicket: TicketData = {
	customerName: "Nathan Vale",
	movieTitle: "WICKED: FOR GOOD",
	moviePoster:
		"https://movingstory-prod.imgix.net/movies/thumbnails/1733103746-Wicked-PosterJPG.jpg",
	sessionDateTime: "29 Nov 2025, 4:15pm-6:52pm",
	screenNumber: "Screen 1",
	seats: "F9, F10",
	// barcodeUrl is optional - will use default decorative barcode if omitted
};

// Generate the HTML ticket
const ticketHtml = generateTicketHtml(sampleTicket);

// Save to file for preview
const outputPath = "examples/sample-ticket.html";
writeFileSync(outputPath, ticketHtml, "utf-8");

console.log("✅ Generated ticket HTML successfully!");
console.log(`📄 Saved to: ${outputPath}`);
console.log("\nOpen the file in a browser to preview the ticket.");

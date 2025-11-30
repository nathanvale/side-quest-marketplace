#!/usr/bin/env bun

/**
 * Interactive Cinema Bandit ticket generator
 *
 * Prompts user for ticket information and booking details,
 * calculates pricing using guest rates, and generates email HTML.
 */

import { calculatePricing } from "../src/calculator.ts";
import { generateTicketHtml } from "../src/template.ts";

/**
 * Prompts user for input
 */
async function prompt(question: string): Promise<string> {
	process.stdout.write(`${question} `);

	const decoder = new TextDecoder();
	for await (const chunk of Bun.stdin.stream()) {
		const input = decoder.decode(chunk).trim();
		if (input) {
			return input;
		}
	}

	return "";
}

/**
 * Prompts for a number with validation
 */
async function promptNumber(question: string): Promise<number> {
	while (true) {
		const input = await prompt(question);
		const num = Number.parseInt(input, 10);

		if (!Number.isNaN(num) && num >= 0) {
			return num;
		}

		console.log("Please enter a valid number (0 or greater)");
	}
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
	console.log("🎬 Cinema Bandit - Ticket Email Generator\n");
	console.log("Using Classic Cinemas guest pricing:");
	console.log("  Adult: $27.00");
	console.log("  Concession (Child): $21.00");
	console.log("  Booking fee: $1.95 per ticket\n");

	// Get ticket counts
	const adults = await promptNumber("How many adult tickets?");
	const children = await promptNumber("How many child/concession tickets?");

	if (adults === 0 && children === 0) {
		console.log("\n❌ You must select at least one ticket!");
		process.exit(1);
	}

	console.log("\n📋 Booking Details:\n");

	// Get booking details
	const customerName = await prompt("Customer first name:");
	const movieTitle = await prompt("Movie title:");
	const moviePoster = await prompt("Movie poster URL:");
	const sessionDateTime = await prompt(
		"Session date/time (e.g., 'Fri 29 Nov, 08:15PM'):",
	);
	const screenNumber = await prompt("Screen number (e.g., 'Screen 3'):");
	const seats = await prompt("Seat numbers (e.g., 'H12, H13'):");
	const bookingNumber = await prompt("Booking reference (optional):");

	// Calculate pricing
	const pricing = calculatePricing({ adults, children });

	console.log("\n💰 Pricing Breakdown:");
	console.log(`  Tickets: ${pricing.ticketSubtotal.toFixed(2)}`);
	console.log(`  Booking Fee: ${pricing.bookingFee}`);
	console.log(`  Total: ${pricing.totalAmount}\n`);

	// Generate email HTML
	const html = generateTicketHtml({
		customerName,
		movieTitle,
		moviePoster,
		sessionDateTime,
		screenNumber,
		seats,
		tickets: pricing.ticketLines,
		invoiceLines: pricing.invoiceLines,
		bookingFee: pricing.bookingFee,
		totalAmount: pricing.totalAmount,
		bookingNumber: bookingNumber || undefined,
		webViewUrl: bookingNumber
			? `https://www.classiccinemas.com.au/bookings/${bookingNumber}`
			: undefined,
	});

	// Output result
	console.log("✅ Email generated successfully!");
	console.log(
		JSON.stringify({
			success: true,
			htmlLength: html.length,
			html,
			pricing: {
				ticketSubtotal: pricing.ticketSubtotal,
				bookingFee: pricing.bookingFee,
				totalAmount: pricing.totalAmount,
			},
		}),
	);
}

main();

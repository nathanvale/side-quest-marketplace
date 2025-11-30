#!/usr/bin/env bun
/**
 * Test script to verify pricing calculations with different ticket combinations
 */

import { calculatePricing } from "../src/calculator.ts";

console.log("🎬 Testing Cinema Bandit Pricing Calculator\n");

const testCases = [
	{ adults: 1, children: 0, description: "1 Adult" },
	{ adults: 2, children: 0, description: "2 Adults" },
	{ adults: 0, children: 1, description: "1 Child" },
	{ adults: 0, children: 2, description: "2 Children" },
	{ adults: 1, children: 1, description: "1 Adult + 1 Child" },
	{ adults: 2, children: 1, description: "2 Adults + 1 Child" },
	{ adults: 1, children: 2, description: "1 Adult + 2 Children" },
	{ adults: 2, children: 2, description: "2 Adults + 2 Children" },
];

for (const testCase of testCases) {
	const pricing = calculatePricing({
		adults: testCase.adults,
		children: testCase.children,
	});

	console.log(`📊 ${testCase.description}`);
	console.log(`   Ticket Subtotal: $${pricing.ticketSubtotal.toFixed(2)}`);
	console.log(`   Booking Fee: ${pricing.bookingFee}`);
	console.log(`   Total: ${pricing.totalAmount}`);

	if (pricing.invoiceLines.length > 0) {
		console.log("   Invoice Lines:");
		for (const line of pricing.invoiceLines) {
			console.log(`     - ${line.description}: ${line.price}`);
		}
	}

	console.log();
}

console.log("✅ All pricing calculations completed successfully!");

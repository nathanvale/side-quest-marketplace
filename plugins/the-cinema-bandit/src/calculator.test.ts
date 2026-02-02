import { describe, expect, test } from "bun:test";
import { formatCurrency } from "@sidequest/core/formatters";
import { calculatePricing, GUEST_PRICES } from "./calculator";

describe("formatCurrency", () => {
	test("formats whole numbers with two decimal places", () => {
		expect(formatCurrency(27)).toBe("$27.00");
		expect(formatCurrency(100)).toBe("$100.00");
	});

	test("formats decimals correctly", () => {
		expect(formatCurrency(27.5)).toBe("$27.50");
		expect(formatCurrency(1.95)).toBe("$1.95");
		expect(formatCurrency(42.123)).toBe("$42.12");
	});
});

describe("calculatePricing", () => {
	test("calculates pricing for 1 adult ticket", () => {
		const result = calculatePricing({ adults: 1, children: 0 });

		expect(result.ticketLines).toEqual([{ type: "Adult", quantity: 1 }]);

		expect(result.invoiceLines).toEqual([
			{ description: "Adult x 1", price: "$27.00" },
		]);

		expect(result.ticketSubtotal).toBe(27.0);
		expect(result.bookingFeeAmount).toBe(1.95);
		expect(result.totalAmountNumber).toBe(28.95);

		expect(result.bookingFee).toBe("$1.95");
		expect(result.totalAmount).toBe("$28.95");
	});

	test("calculates pricing for 2 adult tickets", () => {
		const result = calculatePricing({ adults: 2, children: 0 });

		expect(result.ticketLines).toEqual([{ type: "Adult", quantity: 2 }]);

		expect(result.invoiceLines).toEqual([
			{ description: "Adult x 2", price: "$54.00" },
		]);

		expect(result.ticketSubtotal).toBe(54.0);
		expect(result.bookingFeeAmount).toBe(3.9);
		expect(result.totalAmountNumber).toBe(57.9);

		expect(result.bookingFee).toBe("$3.90");
		expect(result.totalAmount).toBe("$57.90");
	});

	test("calculates pricing for 1 child ticket", () => {
		const result = calculatePricing({ adults: 0, children: 1 });

		expect(result.ticketLines).toEqual([{ type: "Concession", quantity: 1 }]);

		expect(result.invoiceLines).toEqual([
			{ description: "Concession x 1", price: "$21.00" },
		]);

		expect(result.ticketSubtotal).toBe(21.0);
		expect(result.bookingFeeAmount).toBe(1.95);
		expect(result.totalAmountNumber).toBe(22.95);

		expect(result.bookingFee).toBe("$1.95");
		expect(result.totalAmount).toBe("$22.95");
	});

	test("calculates pricing for mixed adult and child tickets", () => {
		const result = calculatePricing({ adults: 2, children: 1 });

		expect(result.ticketLines).toEqual([
			{ type: "Adult", quantity: 2 },
			{ type: "Concession", quantity: 1 },
		]);

		expect(result.invoiceLines).toEqual([
			{ description: "Adult x 2", price: "$54.00" },
			{ description: "Concession x 1", price: "$21.00" },
		]);

		// 2 adults ($27 × 2 = $54) + 1 child ($21) = $75
		expect(result.ticketSubtotal).toBe(75.0);

		// 3 tickets × $1.95 = $5.85
		expect(result.bookingFeeAmount).toBe(5.85);

		// $75 + $5.85 = $80.85
		expect(result.totalAmountNumber).toBe(80.85);

		expect(result.bookingFee).toBe("$5.85");
		expect(result.totalAmount).toBe("$80.85");
	});

	test("calculates pricing for 1 adult and 2 children", () => {
		const result = calculatePricing({ adults: 1, children: 2 });

		expect(result.ticketLines).toEqual([
			{ type: "Adult", quantity: 1 },
			{ type: "Concession", quantity: 2 },
		]);

		expect(result.invoiceLines).toEqual([
			{ description: "Adult x 1", price: "$27.00" },
			{ description: "Concession x 2", price: "$42.00" },
		]);

		// 1 adult ($27) + 2 children ($21 × 2 = $42) = $69
		expect(result.ticketSubtotal).toBe(69.0);

		// 3 tickets × $1.95 = $5.85
		expect(result.bookingFeeAmount).toBe(5.85);

		// $69 + $5.85 = $74.85
		expect(result.totalAmountNumber).toBe(74.85);

		expect(result.bookingFee).toBe("$5.85");
		expect(result.totalAmount).toBe("$74.85");
	});

	test("handles zero tickets gracefully", () => {
		const result = calculatePricing({ adults: 0, children: 0 });

		expect(result.ticketLines).toEqual([]);
		expect(result.invoiceLines).toEqual([]);

		expect(result.ticketSubtotal).toBe(0);
		expect(result.bookingFeeAmount).toBe(0);
		expect(result.totalAmountNumber).toBe(0);

		expect(result.bookingFee).toBe("$0.00");
		expect(result.totalAmount).toBe("$0.00");
	});

	test("uses correct guest pricing constants", () => {
		// Verify the constants match what we discovered
		expect(GUEST_PRICES.adult).toBe(27.0);
		expect(GUEST_PRICES.child).toBe(21.0);
		expect(GUEST_PRICES.bookingFeePerTicket).toBe(1.95);
	});
});

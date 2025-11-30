import { calculatePricing } from "../src/calculator.ts";
import { generateTicketHtml } from "../src/template.ts";

// Calculate pricing for 2 adult tickets
const pricing = calculatePricing({ adults: 2, children: 0 });

const ticketData = {
	customerName: "Nathan",
	movieTitle: "JIFF: Bad Shabbos",
	moviePoster:
		"https://movingstory-prod.imgix.net/movies/thumbnails/bad-shabbos-key-still-lightened-up.jpg?w=450&h=193&auto=compress,format&fit=crop",
	sessionDateTime: "Fri 29 Nov, 08:15PM",
	screenNumber: "Screen 3",
	seats: "H12, H13",
	tickets: pricing.ticketLines,
	bookingNumber: "CC789012",
	invoiceLines: pricing.invoiceLines,
	bookingFee: pricing.bookingFee,
	totalAmount: pricing.totalAmount,
	webViewUrl: "https://www.classiccinemas.com.au/bookings/CC789012",
};

const html = generateTicketHtml(ticketData);

// Output just the result for the calling script
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

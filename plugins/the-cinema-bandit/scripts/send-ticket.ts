import { calculatePricing } from "../src/calculator.ts";
import { sendTicketEmail } from "../src/gmail/send.ts";
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

const messageId = await sendTicketEmail(
	"hi@nathanvale.com",
	ticketData.movieTitle,
	html,
);

console.log(
	JSON.stringify({
		success: true,
		messageId,
		movieTitle: ticketData.movieTitle,
		pricing: {
			ticketSubtotal: pricing.ticketSubtotal,
			bookingFee: pricing.bookingFee,
			totalAmount: pricing.totalAmount,
		},
	}),
);

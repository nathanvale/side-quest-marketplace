/**
 * The Cinema Bandit - Cinema booking email template utilities
 *
 * @packageDocumentation
 */

// Export core utilities (re-export for backward compatibility)
export { formatCurrency, parsePrice } from "@sidequest/core/formatters";
// Export calculator functions and types
export {
	calculatePricing,
	GUEST_PRICES,
	type PricingBreakdown,
	type TicketCounts,
} from "./calculator.js";
// Export Gmail functions and types
export { sendEmail } from "./gmail/index.js";
// Export live price scraper functions and types
export {
	calculatePricingFromScraped,
	type ScrapedPricing,
	validateScrapedPricing,
} from "./price-scraper.js";
// Export scraper types
export type { Movie, SessionDetails, SessionTime } from "./scraper.js";
// Export selector configurations
export {
	buildTicketUrl,
	PRICING_SELECTORS,
	SESSION_SELECTORS,
	type SelectorConfig,
	URLS,
} from "./selectors.js";
// Export template types
export type { InvoiceLine, TicketData, TicketLine } from "./template.js";
// Export template generator functions and types
export { generateTicketHtml, TEMPLATE_PLACEHOLDERS } from "./template.js";

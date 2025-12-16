/**
 * Invoice/Receipt Test Fixtures
 *
 * Integration test fixtures for invoice classifier behavior.
 * Tests BEHAVIOR (filesystem outcomes) not internal state.
 *
 * @module test/integration/fixtures/invoice
 */

import type { DocumentFixture, FixtureSet } from "./index.js";
import { createDocumentTypeFixture } from "./index.js";

/**
 * Complete tax invoice with all fields populated.
 * Tests full invoice extraction including ABN, GST, and structured data.
 */
export const INVOICE_COMPLETE: DocumentFixture<"invoice"> = {
	description: "complete tax invoice with ABN and GST",
	classifier: "invoice",
	input: {
		filename: "Dr Smith Invoice Dec 2024.md",
		content: `---
type: invoice
---

# TAX INVOICE

**Provider:** Dr Smith Medical Practice
**ABN:** 12 345 678 901
**Date:** 2024-12-01
**Invoice Number:** INV-4480

## Services Provided

| Description | Amount |
|-------------|--------|
| General Consultation | $180.00 |
| Medical Certificate | $20.00 |
| Subtotal | $200.00 |
| GST (10%) | $20.00 |
| **Total** | **$220.00 AUD** |

## Payment Details

**Due Date:** 2024-12-15
**Bank:** Commonwealth Bank
**BSB:** 062-000
**Account:** 12345678
**Reference:** INV-4480

## Payment Terms

Payment due within 14 days. Late payment may incur a 10% surcharge.

---

*This is a tax invoice for GST purposes.*
`,
	},
	_mockLLMResponse: createDocumentTypeFixture({
		documentType: "invoice",
		confidence: 0.94,
		reasoning:
			"Strong invoice markers: TAX INVOICE header, ABN, GST, structured payment details",
		suggestedArea: "Finance",
		extractedFields: {
			title: "Dr Smith Medical Invoice",
			invoiceDate: "2024-12-01",
			provider: "Dr Smith Medical Practice",
			amount: "220.00",
			currency: "AUD",
			status: "unpaid",
			dueDate: "2024-12-15",
			abn: "12345678901",
			gst: "20.00",
			invoiceNumber: "INV-4480",
		},
	}),
	expectedOutcome: {
		// Notes are created in Inbox by default with emoji-prefixed titles
		noteCreated: "00 Inbox/🧾 Invoice - Dr Smith Medical Practice.md",
		noteLocation: "00 Inbox",
		frontmatter: {
			type: "invoice",
			// Title comes from LLM extraction, may not match the pattern "Invoice - Provider"
			provider: "Dr Smith Medical Practice",
			amount: 220,
			// Currency comes from LLM extraction, converted to number in frontmatter
		},
		bodyContains: [
			"# TAX INVOICE",
			"INV-4480",
			"ABN:** 12 345 678 901",
			"Payment due within 14 days",
		],
		shouldAutoClassify: true,
	},
	expectedFields: {
		amount: 220.0,
		provider: "Dr Smith Medical Practice",
		invoiceNumber: "INV-4480",
		dueDate: "2024-12-15",
		currency: "AUD",
		abn: "12345678901",
		gst: "20.00",
	},
};

/**
 * Minimal receipt with only essential information.
 * Tests graceful handling of receipts vs formal invoices.
 * No ABN, GST, or invoice number - just amount and provider.
 */
export const INVOICE_MINIMAL: DocumentFixture<"invoice"> = {
	description: "minimal receipt with just amount and provider",
	classifier: "invoice",
	input: {
		filename: "coffee-receipt.md",
		content: `# Receipt

Cafe Luna
Melbourne CBD

**Date:** 2024-12-10

1x Flat White - $5.00
1x Croissant - $6.50

**Total: $11.50**

Thank you for your visit!
`,
	},
	_mockLLMResponse: createDocumentTypeFixture({
		documentType: "invoice",
		confidence: 0.72,
		reasoning:
			"Receipt with clear amount and provider, but minimal formal structure",
		suggestedArea: "Finance",
		extractedFields: {
			title: "Cafe Luna Receipt",
			invoiceDate: "2024-12-10",
			provider: "Cafe Luna",
			amount: "11.50",
			currency: "AUD",
			status: "paid",
		},
	}),
	expectedOutcome: {
		// Notes are created in Inbox by default with emoji-prefixed titles
		noteCreated: "00 Inbox/🧾 Invoice - Cafe Luna.md",
		noteLocation: "00 Inbox",
		frontmatter: {
			type: "invoice",
			title: "Invoice - Cafe Luna",
			provider: "Cafe Luna",
			amount: 11.5,
			currency: "AUD",
			status: "paid",
		},
		bodyContains: ["Cafe Luna", "Total: $11.50"],
		shouldAutoClassify: true,
	},
	expectedFields: {
		amount: 11.5,
		provider: "Cafe Luna",
	},
};

/**
 * Medical statement from healthcare provider.
 * Tests linking to Health area and Medicare claim references.
 */
export const INVOICE_HEALTH: DocumentFixture<"invoice"> = {
	description: "medical statement with Medicare claim",
	classifier: "invoice",
	input: {
		filename: "Medicare Statement 2024-11.md",
		content: `# MEDICARE STATEMENT

**Provider:** Melbourne Medical Centre
**Provider Number:** 1234567A
**Date of Service:** 2024-11-15
**Claim Date:** 2024-11-16

## Service Details

| Item | Description | Fee | Benefit | Gap |
|------|-------------|-----|---------|-----|
| 23 | Level B Consultation | $89.00 | $42.85 | $46.15 |
| 104 | Pathology | $35.00 | $35.00 | $0.00 |

**Total Fee:** $124.00
**Medicare Benefit:** $77.85
**Patient Gap:** $46.15

## Payment

**Amount Due:** $46.15
**Due Date:** 2024-12-01

**Medicare Claim Number:** MC-2024-789456

---

*This statement is for your records. Medicare has been claimed on your behalf.*
`,
	},
	_mockLLMResponse: createDocumentTypeFixture({
		documentType: "invoice",
		confidence: 0.88,
		reasoning:
			"Medical statement with clear healthcare provider and Medicare claim details",
		suggestedArea: "Health",
		extractedFields: {
			title: "Melbourne Medical Centre Statement",
			invoiceDate: "2024-11-15",
			provider: "Melbourne Medical Centre",
			amount: "46.15",
			currency: "AUD",
			status: "unpaid",
			dueDate: "2024-12-01",
			area: "Health",
		},
	}),
	expectedOutcome: {
		// Notes are created in Inbox by default with emoji-prefixed titles
		noteCreated: "00 Inbox/🧾 Invoice - Melbourne Medical Centre.md",
		noteLocation: "00 Inbox",
		frontmatter: {
			type: "invoice",
			title: "Invoice - Melbourne Medical Centre",
			provider: "Melbourne Medical Centre",
			amount: 46.15,
			currency: "AUD",
		},
		bodyContains: [
			"MEDICARE STATEMENT",
			"MC-2024-789456",
			"Patient Gap:** $46.15",
		],
		shouldAutoClassify: true,
	},
	expectedFields: {
		amount: 46.15,
		provider: "Melbourne Medical Centre",
		dueDate: "2024-12-01",
		currency: "AUD",
	},
};

/**
 * Edge case: Foreign currency invoice (USD).
 * Tests currency detection and international provider handling.
 */
const INVOICE_FOREIGN_CURRENCY: DocumentFixture<"invoice"> = {
	description: "invoice with foreign currency (USD)",
	classifier: "invoice",
	input: {
		filename: "aws-invoice-nov-2024.md",
		content: `# Amazon Web Services Invoice

**Invoice Date:** 2024-11-30
**Invoice Number:** AWS-2024-11-123456
**Account ID:** 123456789012

## Charges

| Service | Usage | Amount |
|---------|-------|--------|
| EC2 - US East | 720 hours | $145.20 |
| S3 Storage | 500 GB | $11.50 |
| CloudFront | 1 TB transfer | $85.00 |

**Subtotal:** $241.70 USD
**Tax:** $0.00
**Total:** $241.70 USD

**Payment Method:** Credit Card ending in 1234
**Payment Date:** 2024-12-01

---

*Invoice paid automatically via saved payment method.*
`,
	},
	_mockLLMResponse: createDocumentTypeFixture({
		documentType: "invoice",
		confidence: 0.91,
		reasoning: "Clear invoice structure with USD currency and AWS provider",
		suggestedArea: "Finance",
		extractedFields: {
			title: "Amazon Web Services Invoice",
			invoiceDate: "2024-11-30",
			provider: "Amazon Web Services",
			amount: "241.70",
			currency: "USD",
			status: "paid",
			invoiceNumber: "AWS-2024-11-123456",
		},
	}),
	expectedOutcome: {
		// Notes are created in Inbox by default with emoji-prefixed titles
		noteCreated: "00 Inbox/🧾 Invoice - Amazon Web Services.md",
		noteLocation: "00 Inbox",
		frontmatter: {
			type: "invoice",
			title: "Invoice - Amazon Web Services",
			provider: "Amazon Web Services",
			amount: 241.7,
			currency: "USD",
		},
		bodyContains: ["$241.70 USD", "AWS-2024-11-123456"],
		shouldAutoClassify: true,
	},
	expectedFields: {
		amount: 241.7,
		provider: "Amazon Web Services",
		currency: "USD",
		invoiceNumber: "AWS-2024-11-123456",
	},
};

/**
 * Edge case: Very large amount (property invoice).
 * Tests handling of high-value invoices with EUR currency.
 */
const INVOICE_LARGE_AMOUNT: DocumentFixture<"invoice"> = {
	description: "invoice with very large amount (€50,000+)",
	classifier: "invoice",
	input: {
		filename: "property-legal-fees.md",
		content: `# LEGAL SERVICES INVOICE

**Law Firm:** Brown & Associates Legal
**Date:** 2024-12-05
**Invoice No:** BL-2024-8890
**Matter:** Property Purchase - 123 Main St

## Services Rendered

| Date | Description | Hours | Rate | Amount |
|------|-------------|-------|------|--------|
| Nov 2024 | Contract Review | 12.5 | €450/hr | €5,625.00 |
| Nov 2024 | Due Diligence | 8.0 | €450/hr | €3,600.00 |
| Nov 2024 | Settlement Preparation | 15.0 | €450/hr | €6,750.00 |
| Nov 2024 | Disbursements | - | - | €2,150.00 |

**Subtotal:** €18,125.00
**VAT (23%):** €4,168.75
**Total Due:** €22,293.75 EUR

## Payment Terms

**Due Date:** 2024-12-20
**Bank:** AIB Bank
**IBAN:** IE12 BOFI 9000 0112 3456 78
**BIC:** BOFIIE2D

Late payment subject to interest at 8% per annum.
`,
	},
	_mockLLMResponse: createDocumentTypeFixture({
		documentType: "invoice",
		confidence: 0.93,
		reasoning:
			"Professional services invoice with detailed billing and EUR currency",
		suggestedArea: "Finance",
		extractedFields: {
			title: "Brown & Associates Legal Services",
			invoiceDate: "2024-12-05",
			provider: "Brown & Associates Legal",
			amount: "22293.75",
			currency: "EUR",
			status: "unpaid",
			dueDate: "2024-12-20",
			invoiceNumber: "BL-2024-8890",
		},
	}),
	expectedOutcome: {
		// Notes are created in Inbox by default with emoji-prefixed titles
		noteCreated: "00 Inbox/🧾 Invoice - Brown & Associates Legal.md",
		noteLocation: "00 Inbox",
		frontmatter: {
			type: "invoice",
			title: "Invoice - Brown & Associates Legal",
			provider: "Brown & Associates Legal",
			amount: 22293.75,
			currency: "EUR",
		},
		bodyContains: ["€22,293.75 EUR", "BL-2024-8890", "Property Purchase"],
		shouldAutoClassify: true,
	},
	expectedFields: {
		amount: 22293.75,
		provider: "Brown & Associates Legal",
		currency: "EUR",
		invoiceNumber: "BL-2024-8890",
		dueDate: "2024-12-20",
	},
};

/**
 * Edge case: Missing date with extraction warning.
 * Tests graceful handling when required date field cannot be extracted.
 */
const INVOICE_MISSING_DATE: DocumentFixture<"invoice"> = {
	description: "invoice with missing date (extraction warning expected)",
	classifier: "invoice",
	input: {
		filename: "parking-fine.md",
		content: `# PARKING CITATION

**Citation Number:** PKG-2024-56789
**Vehicle:** VIC ABC123
**Location:** Swanston St, Melbourne

## Violation

Parked in No Standing Zone (Mon-Fri 7am-7pm)

**Fine Amount:** $88.00

## Payment Options

Pay online at: www.melbourne.vic.gov.au/fines
By phone: 1300 111 111
In person: Melbourne Town Hall

**Early Payment Discount:** Pay within 28 days for $61.60

---

Citation issued by Melbourne City Council
`,
	},
	_mockLLMResponse: createDocumentTypeFixture({
		documentType: "invoice",
		confidence: 0.68,
		reasoning:
			"Citation has fine amount and provider, but missing explicit invoice date",
		suggestedArea: "Finance",
		extractedFields: {
			title: "Melbourne City Council Parking Fine",
			provider: "Melbourne City Council",
			amount: "88.00",
			currency: "AUD",
			status: "unpaid",
			invoiceNumber: "PKG-2024-56789",
		},
		extractionWarnings: [
			"Could not extract invoice date from content - using current date as fallback",
		],
	}),
	expectedOutcome: {
		// Notes are created in Inbox by default with emoji-prefixed titles
		noteCreated: "00 Inbox/🧾 Invoice - Melbourne City Council.md",
		noteLocation: "00 Inbox",
		frontmatter: {
			type: "invoice",
			title: "Invoice - Melbourne City Council",
			provider: "Melbourne City Council",
			amount: 88.0,
			currency: "AUD",
		},
		bodyContains: ["PKG-2024-56789", "$88.00"],
		shouldAutoClassify: true,
		warningMessage:
			"Could not extract invoice date from content - using current date as fallback",
	},
	expectedFields: {
		amount: 88.0,
		provider: "Melbourne City Council",
		invoiceNumber: "PKG-2024-56789",
		currency: "AUD",
	},
};

/**
 * Edge case: Ambiguous provider name.
 * Tests handling when provider name is unclear or abbreviated.
 */
const INVOICE_AMBIGUOUS_PROVIDER: DocumentFixture<"invoice"> = {
	description: "invoice with ambiguous provider name",
	classifier: "invoice",
	input: {
		filename: "receipt-scan.md",
		content: `# Receipt

**Store #:** 1247
**Transaction:** 2024-12-10 14:32:45
**Cashier:** J. Smith

GROCERIES:
- Milk 2L.............$4.50
- Bread...............$3.80
- Eggs 12pk...........$6.20
- Cheese.............$8.90

SUBTOTAL...........$23.40
GST................$2.34
TOTAL..............$25.74

PAID: VISA ****1234

Thank you!
Visit us again soon
www.example.com.au
`,
	},
	_mockLLMResponse: createDocumentTypeFixture({
		documentType: "invoice",
		confidence: 0.58,
		reasoning:
			"Receipt structure is clear but provider name is not explicitly stated",
		suggestedArea: "Finance",
		extractedFields: {
			title: "Store Receipt",
			invoiceDate: "2024-12-10",
			provider: "Store #1247",
			amount: "25.74",
			currency: "AUD",
			status: "paid",
			gst: "2.34",
		},
		extractionWarnings: [
			"Provider name is unclear - using store number as fallback",
		],
	}),
	expectedOutcome: {
		// Notes are created in Inbox by default with emoji-prefixed titles
		noteCreated: "00 Inbox/🧾 Invoice - Store #1247.md",
		noteLocation: "00 Inbox",
		frontmatter: {
			type: "invoice",
			title: "Invoice - Store #1247",
			provider: "Store #1247",
			amount: 25.74,
			currency: "AUD",
		},
		bodyContains: ["TOTAL..............$25.74", "GST................$2.34"],
		shouldAutoClassify: false,
		shouldPromptUser: true,
		warningMessage: "Provider name is unclear - using store number as fallback",
	},
	expectedFields: {
		amount: 25.74,
		provider: "Store #1247",
		currency: "AUD",
		gst: "2.34",
	},
};

/**
 * Edge cases collection for invoice classifier.
 */
const INVOICE_EDGE_CASES: DocumentFixture<"invoice">[] = [
	INVOICE_FOREIGN_CURRENCY,
	INVOICE_LARGE_AMOUNT,
	INVOICE_MISSING_DATE,
	INVOICE_AMBIGUOUS_PROVIDER,
];

/**
 * Complete invoice fixture set for integration testing.
 * Provides complete, minimal, and edge case scenarios.
 */
export const INVOICE_FIXTURES: FixtureSet<"invoice"> = {
	complete: INVOICE_COMPLETE,
	minimal: INVOICE_MINIMAL,
	edgeCases: INVOICE_EDGE_CASES,
};

/**
 * Health-specific invoice for area-based routing tests.
 * Exported separately for convenience in health-related test suites.
 */
export const INVOICE_HEALTH_FIXTURE = INVOICE_HEALTH;

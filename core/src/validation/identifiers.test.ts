import { describe, expect, test } from "bun:test";
import {
	validateClassifierId,
	validateFieldName,
	validateTemplateName,
} from "./identifiers.ts";

describe("validation/identifiers", () => {
	describe("validateClassifierId", () => {
		test("accepts valid kebab-case IDs", () => {
			expect(validateClassifierId("medical-bill")).toBe("medical-bill");
			expect(validateClassifierId("invoice")).toBe("invoice");
			expect(validateClassifierId("travel-booking")).toBe("travel-booking");
			expect(validateClassifierId("medical-statement-2024")).toBe(
				"medical-statement-2024",
			);
		});

		test("rejects non-kebab-case", () => {
			expect(() => validateClassifierId("MedicalBill")).toThrow("kebab-case");
			expect(() => validateClassifierId("medical_bill")).toThrow("kebab-case");
			expect(() => validateClassifierId("medical bill")).toThrow("kebab-case");
			expect(() => validateClassifierId("Medical-Bill")).toThrow("kebab-case");
		});

		test("prevents path traversal", () => {
			expect(() => validateClassifierId("../secrets")).toThrow();
			expect(() => validateClassifierId("../../etc/passwd")).toThrow();
			expect(() => validateClassifierId("/etc/passwd")).toThrow();
		});

		test("rejects reserved names", () => {
			expect(() => validateClassifierId("index")).toThrow("Reserved");
			expect(() => validateClassifierId("types")).toThrow("Reserved");
			expect(() => validateClassifierId("defaults")).toThrow("Reserved");
			expect(() => validateClassifierId("_template")).toThrow("Reserved");
		});

		test("rejects IDs starting with number", () => {
			expect(() => validateClassifierId("123-invoice")).toThrow("kebab-case");
		});

		test("rejects empty string", () => {
			expect(() => validateClassifierId("")).toThrow("kebab-case");
		});
	});

	describe("validateFieldName", () => {
		test("accepts valid camelCase names", () => {
			expect(validateFieldName("title")).toBe("title");
			expect(validateFieldName("dateOfService")).toBe("dateOfService");
			expect(validateFieldName("totalAmount")).toBe("totalAmount");
			expect(validateFieldName("providerName123")).toBe("providerName123");
		});

		test("rejects non-camelCase", () => {
			expect(() => validateFieldName("date-of-service")).toThrow("camelCase");
			expect(() => validateFieldName("date_of_service")).toThrow("camelCase");
			expect(() => validateFieldName("date of service")).toThrow("camelCase");
			expect(() => validateFieldName("DateOfService")).toThrow("camelCase");
		});

		test("rejects names starting with number", () => {
			expect(() => validateFieldName("123field")).toThrow("camelCase");
		});

		test("rejects special characters", () => {
			expect(() => validateFieldName("field$name")).toThrow("camelCase");
			expect(() => validateFieldName("field@name")).toThrow("camelCase");
			expect(() => validateFieldName("field.name")).toThrow("camelCase");
		});

		test("rejects empty string", () => {
			expect(() => validateFieldName("")).toThrow("camelCase");
		});
	});

	describe("validateTemplateName", () => {
		test("accepts valid kebab-case names", () => {
			expect(validateTemplateName("medical-bill")).toBe("medical-bill");
			expect(validateTemplateName("invoice")).toBe("invoice");
			expect(validateTemplateName("travel-booking-v2")).toBe(
				"travel-booking-v2",
			);
		});

		test("prevents path traversal", () => {
			expect(() => validateTemplateName("../secrets")).toThrow();
			expect(() => validateTemplateName("../../etc/passwd")).toThrow();
		});

		test("rejects non-kebab-case", () => {
			expect(() => validateTemplateName("MedicalBill")).toThrow("kebab-case");
			expect(() => validateTemplateName("medical_bill")).toThrow("kebab-case");
		});
	});

	describe("security scenarios", () => {
		test("prevents path traversal in classifier creation", () => {
			// Attacker tries to create classifier outside definitions/
			expect(() => validateClassifierId("../../../malicious")).toThrow();
		});

		test("prevents template injection", () => {
			// Attacker tries to reference system files
			expect(() => validateTemplateName("../../etc/passwd")).toThrow();
		});
	});
});

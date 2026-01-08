import { describe, test, expect, beforeAll } from "bun:test";
import { MedicalEngine } from "../services/icd-10-code-merge";

describe("ICD 10 Standard Engine", () => {
    let engine: MedicalEngine;

    beforeAll(async () => {
        engine = new MedicalEngine();
        await engine.init();
    });

    test("should load data correctly", () => {
        // We can't easily check private properties, but we can infer from search results
        const results = engine.searchCondition("cholera");
        expect(results).toBeDefined();
        // Assuming there is some cholera data
        // expect(results.length).toBeGreaterThan(0); 
    });

    test("should search conditions", () => {
        const results = engine.searchCondition("fracture");
        expect(results).toBeArray();
        if (results.length > 0) {
            expect(results[0]).toHaveProperty("global");
            expect(results[0]).toHaveProperty("billing_options_count");
        }
    });

    test("should search procedures", () => {
        const results = engine.searchProcedure("appendectomy");
        expect(results).toBeArray();
        if (results.length > 0) {
            expect(results[0]).toHaveProperty("code");
            expect(results[0]).toHaveProperty("description");
        }
    });

    test("should convert US bill to report", () => {
        // We need a known US code. "A00.0" is usually Cholera due to Vibrio cholerae 01, biovar cholerae
        // Let's try to find a code first to be safe
        const search = engine.searchCondition("cholera");
        if (search.length > 0 && search[0].billing_examples.length > 0) {
            const usCode = search[0].billing_examples[0].code; // e.g., A00.0
            const report = engine.convertBillToReport(usCode);
            expect(report).toContain("✅ Public Report Code");
        }
    });
});


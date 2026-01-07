import { file } from "bun";

// ==========================================
// 1. DATA TYPES (The 3 Standards)
// ==========================================

// 1. WHO Global (Public Health / Grenada Gov)
interface GlobalCode {
    code: string;       // e.g. "S72"
    title: string;      // e.g. "Fracture of femur"
}

// 2. US ICD-10-CM (Private Insurance / SGU - Diagnosis)
interface USDiagnosis {
    code: string;       // e.g. "S72.001A"
    description: string;
    parentCode: string; // Links back to Global (e.g. "S72")
}

// 3. US ICD-10-PCS (Private Insurance - Surgery)
interface USProcedure {
    code: string;       // e.g. "0SRD0J9"
    description: string;
}

// ==========================================
// 2. THE ENGINE CLASS
// ==========================================

class MedicalEngine {
    private globalCodes: GlobalCode[] = [];
    private usDiagnoses: USDiagnosis[] = [];
    private usProcedures: USProcedure[] = [];

    constructor() {}

    // --- INITIALIZATION: Load all files ---
    async init() {
        console.log("⚙️  Initializing Medical Engine...");
        try {
            // Load Global Data
            const globalRaw = await file("./data/int-standard/icd10-int.json").json();
            this.globalCodes = globalRaw.map((i: any) => ({ code: i.code, title: i.title }));

            // Load US Diagnoses
            const cmRaw = await file("./data/us-standard/icd10cm_2026.json").json();
            this.usDiagnoses = cmRaw.map((i: any) => ({
                code: i.code,
                description: i.longDescription,
                parentCode: i.code.split(".")[0] // Extract "S72" from "S72.01"
            }));

            // Load US Procedures
            const pcsRaw = await file("./data/us-standard/icd10pcs_2026.json").json();
            this.usProcedures = pcsRaw.map((i: any) => ({
                code: i.code,
                description: i.longDescription
            }));

            console.log(`✅ Loaded: ${this.globalCodes.length} Global, ${this.usDiagnoses.length} US-CM, ${this.usProcedures.length} US-PCS codes.\n`);

        } catch (e) {
            console.error("❌ Error loading data. Check file paths!", e);
        }
    }

    // --- SEARCH 1: CONDITIONS (Unified Search) ---
    // Finds the Global category first, then attaches US billing options
    searchCondition(query: string) {
        const q = query.toLowerCase();

        // Step 1: Find Global Parent (WHO)
        const matches = this.globalCodes
            .filter(c => c.title.toLowerCase().includes(q) || c.code.toLowerCase().includes(q))
            .slice(0, 5); // Limit to top 5

        // Step 2: Attach US Children (CM)
        return matches.map(global => {
            const usChildren = this.usDiagnoses.filter(us => us.code.startsWith(global.code));
            
            return {
                type: "DIAGNOSIS",
                global: global,               // The Public Health Code
                billing_options_count: usChildren.length,
                billing_examples: usChildren.slice(0, 3) // Preview 3 US codes
            };
        });
    }

    // --- SEARCH 2: PROCEDURES (US Only) ---
    // PCS codes are distinct, so we search them separately
    searchProcedure(query: string) {
        const q = query.toLowerCase();
        return this.usProcedures
            .filter(p => p.description.toLowerCase().includes(q) || p.code.toLowerCase().includes(q))
            .slice(0, 5)
            .map(p => ({
                type: "PROCEDURE",
                code: p.code,
                description: p.description
            }));
    }

    // --- UTILITY: Report Converter (US -> Global) ---
    // Converts a private clinic bill into a Ministry of Health report
    convertBillToReport(usCode: string) {
        const root = usCode.split(".")[0];
        const globalMatch = this.globalCodes.find(g => g.code === root);
        
        if (globalMatch) {
            return {
                original_bill: usCode,
                report_code: globalMatch.code,
                report_title: globalMatch.title,
                status: "✅ VALID FOR PUBLIC REPORTING"
            };
        }
        return { original_bill: usCode, status: "❌ NO MAPPING FOUND" };
    }
}

// ==========================================
// 3. DEMO RUNNER
// ==========================================

async function main() {
    const engine = new MedicalEngine();
    await engine.init();

    // SCENARIO 1: Doctor searches for a disease
    console.log("🔍 SCENARIO 1: Searching for 'Appendicitis'...");
    const results = engine.searchCondition("Appendicitis");
    
    results.forEach(res => {
        console.log(`\n🌍 GLOBAL CODE: [${res.global.code}] ${res.global.title}`);
        console.log(`   ↳ Found ${res.billing_options_count} US billing codes. Examples:`);
        res.billing_examples.forEach(ex => console.log(`      🇺🇸 ${ex.code}: ${ex.description}`));
    });

    console.log("\n-----------------------------------");

    // SCENARIO 2: Surgeon logs a procedure
    console.log("🔪 SCENARIO 2: Searching for 'Appendectomy'...");
    const procedures = engine.searchProcedure("Appendectomy");
    procedures.forEach(p => {
        console.log(`   ⚡ PCS CODE: [${p.code}] ${p.description}`);
    });

    console.log("\n-----------------------------------");

    // SCENARIO 3: Converting Private Bill to Public Report
    console.log("📊 SCENARIO 3: Reporting 'K35.80' (Unspec. Acute Appendicitis) to Ministry...");
    console.log(engine.convertBillToReport("K35.80"));
}

await main();

/**
 * 
 * This allow you to search
 */
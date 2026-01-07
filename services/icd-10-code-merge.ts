import { file } from "bun";
import { createInterface } from "readline";

// ==========================================
// 1. DATA TYPES
// ==========================================
interface GlobalCode {
    code: string;
    title: string;
}

interface USDiagnosis {
    code: string;
    description: string;
    parentCode: string;
}

interface USProcedure {
    code: string;
    description: string;
}

// ==========================================
// 2. THE ENGINE CLASS (Same Logic)
// ==========================================
class MedicalEngine {
    private globalCodes: GlobalCode[] = [];
    private usDiagnoses: USDiagnosis[] = [];
    private usProcedures: USProcedure[] = [];

    constructor() {}

    async init() {
        process.stdout.write("⚙️  Loading Medical Database... ");
        try {
            // Load Global Data
            const globalRaw = await file("./data/int-standard/icd10-int.json").json();
            this.globalCodes = globalRaw.map((i: any) => ({ code: i.code, title: i.title }));

            // Load US Diagnoses
            const cmRaw = await file("./data/us-standard/icd10cm_2026.json").json();
            this.usDiagnoses = cmRaw.map((i: any) => ({
                code: i.code,
                description: i.longDescription,
                parentCode: i.code.split(".")[0]
            }));

            // Load US Procedures
            const pcsRaw = await file("./data/us-standard/icd10pcs_2026.json").json();
            this.usProcedures = pcsRaw.map((i: any) => ({
                code: i.code,
                description: i.longDescription
            }));

            console.log(`\n✅ Ready! Loaded: ${this.globalCodes.length} Global, ${this.usDiagnoses.length} US-CM, ${this.usProcedures.length} US-PCS codes.`);

        } catch (e) {
            console.error("\n❌ Error loading data. Check file paths!", e);
            process.exit(1);
        }
    }

    // Search Conditions (Global + US)
    searchCondition(query: string) {
        const q = query.toLowerCase();
        const matches = this.globalCodes
            .filter(c => c.title.toLowerCase().includes(q) || c.code.toLowerCase().includes(q))
            .slice(0, 5);

        return matches.map(global => {
            const usChildren = this.usDiagnoses.filter(us => us.code.startsWith(global.code));
            return {
                global: global,
                billing_options_count: usChildren.length,
                billing_examples: usChildren.slice(0, 3)
            };
        });
    }

    // Search Procedures (US Only)
    searchProcedure(query: string) {
        const q = query.toLowerCase();
        return this.usProcedures
            .filter(p => p.description.toLowerCase().includes(q) || p.code.toLowerCase().includes(q))
            .slice(0, 5)
            .map(p => ({ code: p.code, description: p.description }));
    }

    // Convert US Bill -> Global Report
    convertBillToReport(usCode: string) {
        const root = usCode.split(".")[0];
        const globalMatch = this.globalCodes.find(g => g.code === root);
        if (globalMatch) {
            return `✅ Public Report Code: [${globalMatch.code}] ${globalMatch.title}`;
        }
        return `❌ No mapping found for ${usCode}`;
    }
}

// ==========================================
// 3. INTERACTIVE CLI
// ==========================================
async function startCLI() {
    const engine = new MedicalEngine();
    await engine.init();

    const rl = createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const promptUser = () => {
        console.log("\n=============================================");
        console.log("Select an option:");
        console.log("  [1] Search Condition (Disease/Injury)");
        console.log("  [2] Search Procedure (Surgery/Action)");
        console.log("  [3] Convert US Code to Public Report");
        console.log("  [q] Quit");
        rl.question("👉 Choice: ", (choice) => {
            handleChoice(choice.trim());
        });
    };

    const handleChoice = (choice: string) => {
        if (choice === 'q') {
            console.log("👋 Exiting...");
            rl.close();
            process.exit(0);
        }

        if (choice === '1') {
            rl.question("🔎 Enter condition (e.g., 'Appendicitis'): ", (query) => {
                const results = engine.searchCondition(query);
                if (results.length === 0) console.log("   ❌ No matches found.");
                
                results.forEach(res => {
                    console.log(`\n   🌍 [${res.global.code}] ${res.global.title}`);
                    console.log(`      ↳ Has ${res.billing_options_count} US billing codes.`);
                    if(res.billing_options_count > 0) console.log("      Examples: " + res.billing_examples.map(e => e.code).join(", "));
                });
                promptUser();
            });
        } 
        else if (choice === '2') {
            rl.question("🔪 Enter procedure (e.g., 'Appendectomy'): ", (query) => {
                const results = engine.searchProcedure(query);
                if (results.length === 0) console.log("   ❌ No matches found.");

                results.forEach(res => {
                    console.log(`   ⚡ [${res.code}] ${res.description}`);
                });
                promptUser();
            });
        }
        else if (choice === '3') {
            rl.question("🔄 Enter US Code (e.g., 'S72.001A'): ", (code) => {
                console.log("   " + engine.convertBillToReport(code));
                promptUser();
            });
        }
        else {
            console.log("   ❌ Invalid choice.");
            promptUser();
        }
    };

    // Start the loop
    promptUser();
}

startCLI();
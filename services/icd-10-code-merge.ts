import { file } from "bun";
import { createInterface } from "readline";

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

export class MedicalEngine {
    private globalCodes: GlobalCode[] = [];
    private usDiagnoses: USDiagnosis[] = [];
    private usProcedures: USProcedure[] = [];
    private usChildrenIndex = new Map<string, USDiagnosis[]>();
    private proceduresIndex = new Map<string, USProcedure[]>();
    
    private globalCodeMap = new Map<string, GlobalCode>();
    private globalTokenIndex = new Map<string, GlobalCode[]>();

    constructor() {}

    private tokenize(text: string): string[] {
        return text.toLowerCase()
            .replace(/[^a-z0-9\s]/g, '') // remove special chars
            .split(/\s+/) // split by whitespace
            .filter(w => w.length > 2); // ignore short words like 'of', 'in'
    }

    async init() {
        process.stdout.write("⚙️  Loading Medical Database... ");
        try {
            const globalRaw = await file("./data/int-standard/icd10-int.json").json();
            this.globalCodes = globalRaw.map((i: any) => ({ code: i.code, title: i.title }));

            for (const g of this.globalCodes) {
                this.globalCodeMap.set(g.code, g);

                const tokens = this.tokenize(g.title);
                tokens.push(g.code.toLowerCase());
                
                const uniqueTokens = new Set(tokens);
                for (const token of uniqueTokens) {
                    if (!this.globalTokenIndex.has(token)) {
                        this.globalTokenIndex.set(token, []);
                    }
                    this.globalTokenIndex.get(token)!.push(g);
                }
            }

            const cmRaw = await file("./data/us-standard/icd10cm_2026.json").json();
            this.usDiagnoses = cmRaw.map((i: any) => ({
                code: i.code,
                description: i.longDescription,
                parentCode: i.code.split(".")[0]
            }));

            for (const diagnosis of this.usDiagnoses) {
                const root = diagnosis.code.substring(0, 3);
                if (!this.usChildrenIndex.has(root)) {
                    this.usChildrenIndex.set(root, []);
                }
                this.usChildrenIndex.get(root)!.push(diagnosis);
            }

            const pcsRaw = await file("./data/us-standard/icd10pcs_2026.json").json();
            this.usProcedures = pcsRaw.map((i: any) => ({
                code: i.code,
                description: i.longDescription
            }));

            for (const proc of this.usProcedures) {
                const tokens = this.tokenize(proc.description);
                tokens.push(proc.code.toLowerCase());

                const uniqueTokens = new Set(tokens);

                for (const token of uniqueTokens) {
                    if (!this.proceduresIndex.has(token)) {
                        this.proceduresIndex.set(token, []);
                    }
                    this.proceduresIndex.get(token)!.push(proc);
                }
            }

            console.log(`\n✅ Ready! Loaded: ${this.globalCodes.length} Global, ${this.usDiagnoses.length} US-CM, ${this.usProcedures.length} US-PCS codes.`);

        } catch (e) {
            console.error("\n❌ Error loading data. Check file paths!", e);
            process.exit(1);
        }
    }

    // Search Conditions (Global + US)
    searchCondition(query: string) {
        const tokens = this.tokenize(query);
        if (tokens.length === 0) return [];

        let candidates = this.globalTokenIndex.get(tokens[0]) || [];

        for (let i = 1; i < tokens.length; i++) {
            const nextWordMatches = new Set(this.globalTokenIndex.get(tokens[i]) || []);
            candidates = candidates.filter(c => nextWordMatches.has(c));
            if (candidates.length === 0) break;
        }

        const matches = candidates.slice(0, 5);

        return matches.map(global => {
            const root = global.code.substring(0, 3);
            const candidates = this.usChildrenIndex.get(root) || [];
            
            const usChildren = candidates.filter(us => us.code.startsWith(global.code));
            
            return {
                global: global,
                billing_options_count: usChildren.length,
                billing_examples: usChildren.slice(0, 3)
            };
        });
    }

    // Search Procedures (US Only)
    searchProcedure(query: string) {
        const tokens = this.tokenize(query);
        if (tokens.length === 0) return [];

        let candidates = this.proceduresIndex.get(tokens[0]) || [];

        for (let i = 1; i < tokens.length; i++) {
            const nextWordMatches = new Set(this.proceduresIndex.get(tokens[i]) || []);
            candidates = candidates.filter(c => nextWordMatches.has(c));
            
            if (candidates.length === 0) break;
        }

        return candidates
            .slice(0, 5)
            .map(p => ({ code: p.code, description: p.description }));
    }

    // Convert US Bill -> Global Report
    convertBillToReport(usCode: string) {
        let globalMatch = this.globalCodeMap.get(usCode);
        
        if (!globalMatch) {
            const root = usCode.split(".")[0];
            globalMatch = this.globalCodeMap.get(root);
        }

        if (globalMatch) {
            return `✅ Public Report Code: [${globalMatch.code}] ${globalMatch.title}`;
        }
        return `❌ No mapping found for ${usCode}`;
    }
}

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

    promptUser();
}

if (import.meta.main) {
    startCLI();
}
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
export class MedicalEngine {
    private globalCodes: GlobalCode[] = [];
    private usDiagnoses: USDiagnosis[] = [];
    private usProcedures: USProcedure[] = [];
    private usChildrenIndex = new Map<string, USDiagnosis[]>();
    private proceduresIndex = new Map<string, USProcedure[]>();
    
    // NEW: Optimization Maps for Global Codes
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
            // Load Global Data
            const globalRaw = await file("./data/int-standard/icd10-int.json").json();
            this.globalCodes = globalRaw.map((i: any) => ({ code: i.code, title: i.title }));

            // Build Global Code Indexes
            for (const g of this.globalCodes) {
                // 1. Direct Code Lookup Map (for convertBillToReport)
                this.globalCodeMap.set(g.code, g);

                // 2. Token Index (for searchCondition)
                const tokens = this.tokenize(g.title);
                tokens.push(g.code.toLowerCase()); // Index code as well
                
                const uniqueTokens = new Set(tokens);
                for (const token of uniqueTokens) {
                    if (!this.globalTokenIndex.has(token)) {
                        this.globalTokenIndex.set(token, []);
                    }
                    this.globalTokenIndex.get(token)!.push(g);
                }
            }

            // Load US Diagnoses
            const cmRaw = await file("./data/us-standard/icd10cm_2026.json").json();
            this.usDiagnoses = cmRaw.map((i: any) => ({
                code: i.code,
                description: i.longDescription,
                parentCode: i.code.split(".")[0]
            }));

            // Build Index: Map Global Code -> List of US Children
            // This makes lookups instant (O(1)) instead of scanning the whole list (O(n))
            for (const diagnosis of this.usDiagnoses) {
                // We use the 'parentCode' (the part before the dot, e.g. A00 from A00.0)
                // or we match against startsWith logic if needed, but here we group by exact root match for speed
                // Actually, the previous logic was: us.code.startsWith(global.code).
                // Global codes are usually 3 chars (A00) or sometimes more (A00.0).
                
                // Let's optimize for the common case: The global code is the prefix.
                // Since 'startsWith' is what we want, a simple Map key might not cover all cases if global codes vary in length.
                // BUT, looking at the previous code: `us.code.startsWith(global.code)`.
                // A Trie would be perfect, but a simple Map of "Root -> Children" works if we know the structure.
                
                // For now, let's index by the first 3 characters (Category), which is the most common breakdown.
                // OR, we can just iterate. Wait, 98k isn't THAT big.
                // The previous bottleneck was `matches.map(...)` where for EACH match (5 max) we scan 98k.
                // That's 5 * 98,000 = 490,000 ops.
                
                // Better approach:
                // Since we only match 5 global codes, we can't easily pre-index EVERYTHING for startsWith perfectly without a Trie.
                // HOWEVER, most global codes in ICD-10 are the "category" (3 chars) or "subcategory" (4 chars).
                
                // Let's stick to the simplest optimization first:
                // Most mappings are based on the 3-character category.
                // Let's index by the 3-character root.
                const root = diagnosis.code.substring(0, 3);
                if (!this.usChildrenIndex.has(root)) {
                    this.usChildrenIndex.set(root, []);
                }
                this.usChildrenIndex.get(root)!.push(diagnosis);
            }

            // Load US Procedures
            const pcsRaw = await file("./data/us-standard/icd10pcs_2026.json").json();
            this.usProcedures = pcsRaw.map((i: any) => ({
                code: i.code,
                description: i.longDescription
            }));

            // Build Procedure Text Index (Inverted Index)
            // Word -> List of Procedures containing that word
            for (const proc of this.usProcedures) {
                const tokens = this.tokenize(proc.description);
                // Also index the code itself for direct code lookups
                tokens.push(proc.code.toLowerCase());

                // Remove duplicates to avoid indexing same word twice for same record
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

        // 1. Get matches for the first word
        let candidates = this.globalTokenIndex.get(tokens[0]) || [];

        // 2. Intersect with matches for subsequent words
        for (let i = 1; i < tokens.length; i++) {
            const nextWordMatches = new Set(this.globalTokenIndex.get(tokens[i]) || []);
            candidates = candidates.filter(c => nextWordMatches.has(c));
            if (candidates.length === 0) break;
        }

        // Limit results to 5
        const matches = candidates.slice(0, 5);

        return matches.map(global => {
            // OPTIMIZED: Use the index instead of scanning 98k items.
            // We assume the global code usually maps to a 3-char root or we check the index for the matching root.
            // If the global code is longer than 3 chars (e.g. A00.0), we can still look up the root "A00" 
            // and THEN filter that smaller list.
            const root = global.code.substring(0, 3);
            const candidates = this.usChildrenIndex.get(root) || [];
            
            // Now we only filter the small subset (usually 10-100 items) instead of 98,000
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

        // 1. Get matches for the first word
        let candidates = this.proceduresIndex.get(tokens[0]) || [];

        // 2. Intersect with matches for subsequent words
        // e.g. "brain destruction" -> find items in BOTH "brain" list AND "destruction" list
        for (let i = 1; i < tokens.length; i++) {
            const nextWordMatches = new Set(this.proceduresIndex.get(tokens[i]) || []);
            candidates = candidates.filter(c => nextWordMatches.has(c));
            
            // Optimization: If candidates drop to zero, stop early
            if (candidates.length === 0) break;
        }

        return candidates
            .slice(0, 5)
            .map(p => ({ code: p.code, description: p.description }));
    }

    // Convert US Bill -> Global Report
    convertBillToReport(usCode: string) {
        // Optimized: O(1) Lookup
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

if (import.meta.main) {
    startCLI();
}
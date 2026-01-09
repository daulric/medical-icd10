import { file, write } from "bun";
//import { icd10PcsSection1, icd10PcsSection2, icd10PcsSection3, type FinalizeData } from "./pcs-group-codes";

// Output file path
const OUTPUT_PATH = "./data/us-standard/grouping/pcs-grouped.json";

// Define the type for the object
type ICD10PCSSection = Record<string, string>;

// The object containing key-value pairs
export const icd10PcsSection1: ICD10PCSSection = {
  // --- Medical and Surgical-related Sections (0-9) ---
  '0': 'Medical and Surgical',
  '1': 'Obstetrics',
  '2': 'Placement',
  '3': 'Administration',
  '4': 'Measurement and Monitoring',
  '5': 'Extracorporeal Assistance and Performance',
  '6': 'Extracorporeal Therapies',
  '7': 'Osteopathic',
  '8': 'Other Procedures',
  '9': 'Chiropractic',

  // --- Ancillary Sections (B-H) ---
  'B': 'Imaging',
  'C': 'Nuclear Medicine',
  'D': 'Radiation Therapy',
  'F': 'Physical Rehabilitation and Diagnostic Audiology',
  'G': 'Mental Health',
  'H': 'Substance Abuse Treatment',

  // --- New Technology (X) ---
  'X': 'New Technology'
};

export const icd10PcsSection2: ICD10PCSSection = {
  '0': 'Nervous System',
  '1': 'Peripheral Nervous System',

  // --- Circulatory System ---
  '2': 'Heart and Great Vessels',
  '3': 'Upper Arteries',
  '4': 'Lower Arteries',
  '5': 'Upper Veins',
  '6': 'Lower Veins',

  // --- Lymphatic & Hemic ---
  '7': 'Lymphatic and Hemic Systems',

  // --- Senses ---
  '8': 'Eye',
  '9': 'Ear, Nose, Sinus',

  // --- Respiratory ---
  'B': 'Respiratory System',

  // --- Digestive ---
  'C': 'Mouth and Throat',
  'D': 'Gastrointestinal System',
  'F': 'Hepatobiliary System and Pancreas',

  // --- Endocrine ---
  'G': 'Endocrine System',

  // --- Integumentary ---
  'H': 'Skin and Breast',
  'J': 'Subcutaneous Tissue and Fascia',

  // --- Musculoskeletal (Soft Tissue) ---
  'K': 'Muscles',
  'L': 'Tendons',
  'M': 'Bursae and Ligaments',

  // --- Musculoskeletal (Bones) ---
  'N': 'Head and Facial Bones',
  'P': 'Upper Bones',
  'Q': 'Lower Bones',

  // --- Musculoskeletal (Joints) ---
  'R': 'Upper Joints',
  'S': 'Lower Joints',

  // --- Genitourinary ---
  'T': 'Urinary System',
  'U': 'Female Reproductive System',
  'V': 'Male Reproductive System',

  // --- Anatomical Regions ---
  'W': 'Anatomical Regions, General',
  'X': 'Anatomical Regions, Upper Extremities',
  'Y': 'Anatomical Regions, Lower Extremities',

  'Z': 'No Qualifier'
};

export const icd10PcsSection3: ICD10PCSSection = {
    'A': 'Assistance',
    "E": "Restoration",
    // --- Group 1: Taking out some/all of a body part ---
  'B': 'Excision',    // Portion of a body part
  'T': 'Resection',   // All of a body part
  '6': 'Detachment',  // Amputation (extremities only)
  '5': 'Destruction', // Physical eradication (e.g., cautery)
  'D': 'Extraction',  // Pulling/stripping out

  // --- Group 2: Taking out solids/fluids/gases ---
  '9': 'Drainage',
  'C': 'Extirpation', // Taking out solid matter (e.g., clot)
  'F': 'Fragmentation',

  // --- Group 3: Cutting or separation only ---
  '8': 'Division',
  'N': 'Release',     // Freeing from constraint (e.g., scar tissue)

  // --- Group 4: Putting in/back or moving body parts ---
  'Y': 'Transplantation',
  'M': 'Reattachment',
  'X': 'Transfer',
  'S': 'Reposition',  // Moving to normal location (e.g., fracture reduction)

  // --- Group 5: Altering diameter/route of tubular parts ---
  '1': 'Bypass',
  '7': 'Dilation',
  'L': 'Occlusion',   // Completely closing
  'V': 'Restriction', // Partially closing

  // --- Group 6: Procedures that always involve Devices ---
  'H': 'Insertion',
  'R': 'Replacement',
  'U': 'Supplement',  // Reinforcing/augmenting
  '2': 'Change',
  'P': 'Removal',     // Taking out a device
  'W': 'Revision',    // Correcting a device

  // --- Group 7: Other Objectives ---
  '0': 'Alteration',  // Cosmetic (e.g., face lift)
  '4': 'Creation',    // Sex change operations
  'G': 'Fusion',      // Immobilizing a joint
  'J': 'Inspection',
  'K': 'Map',
  'Q': 'Repair',      // Restoring to normal structure
  '3': 'Control',      // Stopping post-procedural bleeding

  'Z': 'No Qualifier'
}

export type FinalizeData = {
    code: string;
    category: typeof icd10PcsSection1[string];
    sub_category: typeof icd10PcsSection2[string];
    group_code: typeof icd10PcsSection3[string];
    description: string;
    long_description: string;
    has_specification_codes: boolean;
    specification_codes?: Map<string, {
        code: string;
        description: string;
        long_description: string;
    }>;
}


// Helper: Create the parent container for a 3-digit code
function createParent(rootCode: string): FinalizeData | null {
    if (rootCode.length !== 3) return null;
    
    return {
        code: rootCode,
        category: icd10PcsSection1[rootCode[0]] || "Unknown",
        sub_category: icd10PcsSection2[rootCode[1]] || "Unknown",
        group_code: icd10PcsSection3[rootCode[2]] || "Unknown",
        description: "", // Will be filled if there's a specific description for the header, otherwise usually generated
        long_description: "", 
        has_specification_codes: false,
        // We use a Map initially for easy insertion, but we'll convert to Array for JSON
        specification_codes: new Map() 
    };
}

async function groupPCSCodes() {
    console.log("Loading PCS Data...");
    const rawData = await file("./data/us-standard/icd10pcs_2026.json").json();
    
    // Map: "001" -> FinalizeData Object
    const groupedData = new Map<string, FinalizeData>();

    let count = 0;

    for (const item of rawData) {
        const fullCode = item.code; // e.g. "0016070"
        if (fullCode.length < 3) continue;

        const rootCode = fullCode.substring(0, 3); // e.g. "001"

        // 1. Ensure Parent Exists
        if (!groupedData.has(rootCode)) {
            const parent = createParent(rootCode);
            if (parent) {
                // Determine description for the parent
                // Often the 3-digit header has a description in the raw data if isHeader=true
                // But if not, we construct it from the sections
                const generatedDesc = `${parent.category} - ${parent.sub_category} - ${parent.group_code}`;
                
                parent.description = generatedDesc;
                
                groupedData.set(rootCode, parent);
            }
        }

        const parent = groupedData.get(rootCode);
        if (!parent) continue;

        // 2. Handle the Child (7-digit code)
        // Note: Sometimes the 3-digit code ITSELF exists in the dataset as a header.
        if (fullCode.length === 3) {
            // Priority: Use the actual dataset description if available
            if (item.longDescription) {
                parent.description = item.longDescription;
                parent.long_description = item.longDescription;
            } else if (item.isHeader && item.shortDescription) {
                 parent.description = item.shortDescription;
            }
            continue; 
        }

        // Add 7-digit code to specifications
        if (fullCode.length === 7) {
            parent.has_specification_codes = true;
            
            // TS Trick: We defined it as Map in our function but type says Map | undefined
            if (!parent.specification_codes) parent.specification_codes = new Map();

            parent.specification_codes.set(fullCode, {
                code: fullCode,
                description: item.shortDescription,
                long_description: item.longDescription
            });
        }
        count++;
    }

    console.log(`Grouped ${count} codes into ${groupedData.size} categories.`);

    // 3. Convert Maps to Arrays for JSON serialization
    const outputArray = Array.from(groupedData.values()).map(item => {
        // Convert the specification_codes Map to an Array of values
        const specs = item.specification_codes 
            ? Array.from(item.specification_codes.values()) 
            : [];
        
        // Return a clean object matching the FinalizeData structure (but with array specs)
        return {
            ...item,
            specification_codes: specs
        };
    });

    // 4. Sort by code
    outputArray.sort((a, b) => a.code.localeCompare(b.code));

    console.log(`Saving to ${OUTPUT_PATH}...`);
    await write(OUTPUT_PATH, JSON.stringify(outputArray, null, 2));
    console.log("Done.");
}

if (import.meta.main) {
    await groupPCSCodes();
}
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
    group: typeof icd10PcsSection3[string];
    description: string;
    long_description: string;
    title: string;
    has_specification_codes: boolean;
    specification_codes: {
        code: string;
        description: string;
        long_description: string;
    };
}

// if the length of the initial string is 3, then its the starting code
// if the length of the initial string is more than 3, then its the specification code

import { file, write } from "bun";

function getSectionCode( code: string) {
    if (code.length < 3) return null; // PCS codes are always 7 chars, but root is first 3
    const split_code = code.split("");
    
    // We only care about the first 3 chars for the sections defined above
    return [icd10PcsSection1[split_code[0]], icd10PcsSection2[split_code[1]], icd10PcsSection3[split_code[2]]];
}

async function main() {
    const data = await file("./data/us-standard/icd10pcs_2026.json").json();

    // No need for async/await inside map since getSectionCode is synchronous
    let top_level_codes = data.map((i: any) => {
        const result = getSectionCode(i.code);
        if (!result) return null; // Handle codes that don't match (though all PCS should match)
        
        const [ section1, section2, section3 ] = result;
        console.log(section1, section2, section3, i.code); // Comment out for speed
        return {
            code: i.code,
            section: section1,
            bodySystem: section2,
            operation: section3
        };
    }).filter((x: any) => x !== null);

    // to to a csv
    const csv = top_level_codes.map((i: any) => `${i.code},${i.section},${i.bodySystem},${i.operation}`).join("\n");
    await write("./data/us-standard/grouping/pcs-grouping.csv", csv);

    console.log(`Processed ${top_level_codes.length} codes.`);
    // console.log(JSON.stringify(top_level_codes.slice(0, 5), null, 2));
}

await main();
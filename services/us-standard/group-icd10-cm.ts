import { file, write } from "bun";

// Define the shape of your input items
interface ICD10Item {
  code: string;
  rawCode: string;
  isHeader: boolean;
  shortDescription: string;
  longDescription: string;
}

// Define the final output structure matching the database schema
export type FinalizeData2 = {
    name: string;
    icd10_code: string;
    snomed_ct_code?: string;
    short_display_name?: string;
    description: string;
    synonyms?: string;
    category?: string;
    category_icd_code?: string;
    sub_category?: string;
    sub_category_icd_code?: string;
    related?: Record<string, any>;
    has_specification_codes: boolean;
    specification_codes?: any[];
}

async function main() {
  const inputPath = "data/us-standard/icd10cm_2026.json";
  const outputPath = "data/us-standard/grouping/icd10cm_grouped.json";

  console.log(`Reading from ${inputPath}...`);
  const rawData = await file(inputPath).json() as ICD10Item[];

  console.log(`Processing ${rawData.length} items...`);

  // Map to store parent codes (3-character codes)
  const groups = new Map<string, FinalizeData2>();
  
  // List to store items that don't have a 3-letter parent in the dataset 
  const orphans: FinalizeData2[] = [];

  // 1. First pass: Identify all "Parent" codes (length 3, no dot)
  for (const item of rawData) {
    if (item.code.length === 3 && !item.code.includes('.')) {
      groups.set(item.code, {
        name: item.shortDescription,
        icd10_code: item.code,
        short_display_name: item.shortDescription,
        description: item.longDescription,
        has_specification_codes: true, // Will be verified if children are added
        specification_codes: []
      });
    }
  }

  // 2. Second pass: Assign children to parents
  for (const item of rawData) {
    // Skip if it's a parent itself
    if (groups.has(item.code)) continue;

    const parentCode = item.code.split('.')[0]; // "Z32.0" -> "Z32"

    if (groups.has(parentCode)) {
      groups.get(parentCode)!.specification_codes!.push({
        icd10_code: item.code,
        name: item.shortDescription,
        description: item.longDescription
      });
    } else {
      // Treat as orphan if no parent found
      orphans.push({
        name: item.shortDescription,
        icd10_code: item.code,
        short_display_name: item.shortDescription,
        description: item.longDescription,
        has_specification_codes: false
      });
    }
  }

  // 3. Construct the final list
  const result = [...groups.values(), ...orphans];

  // Optional: Sort by code to keep it tidy
  result.sort((a, b) => a.icd10_code.localeCompare(b.icd10_code));

  console.log(`Grouping complete.`);
  console.log(`- ${groups.size} parent categories created.`);
  console.log(`- ${orphans.length} orphan codes (no 3-letter parent found).`);
  console.log(`- Total top-level items: ${result.length}`);

  console.log(`Writing to ${outputPath}...`);
  await write(outputPath, JSON.stringify(result, null, 2));
  console.log("Done!");
}

main();

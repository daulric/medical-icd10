const Resource = "Medication"
const api_url = process.env.SAPI_URL
const token = process.env.SAPI_KEY

const path = "./data/drugs/PCA Mar21.json"

import { file } from "bun"

// Load local data
const localData = await file(path).json()
console.log(`Loaded ${localData.length} items from local file.`);

const normalizeKeys = (obj) => {
    if (typeof obj !== 'object' || obj === null) return obj;
  
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => {
        // 1. Convert key to lowercase
        // 2. Replace all spaces (global regex) with underscores
        const newKey = key.toLowerCase().replace(/ /g, '_');
        
        return [newKey, value];
      })
    );
};

// 1. Fetch existing data from API
console.log("Fetching existing data from API...");
const getAllResources = async () => {
    // Note: You might need pagination here if the API doesn't return everything in one go.
    // Assuming it returns all or we just check the first page for now? 
    // Or does the API support fetching all?
    // Let's assume standard GET returns { data: [...] }
    const response = await fetch(`${api_url}/api/${Resource}s`, {
        headers: {
            "Authorization": `Bearer ${token}`
        }
    });
    
    if (!response.ok) {
        throw new Error(`Failed to fetch resources: ${response.statusText}`);
    }

    return await response.json();
}

let existingData = [];
try {
    const apiResponse = await getAllResources() as any;
    if (apiResponse && Array.isArray(apiResponse.data)) {
        existingData = apiResponse.data;
    } else if (Array.isArray(apiResponse)) {
        existingData = apiResponse;
    }
    console.log(`Fetched ${existingData.length} existing items from API.`);
} catch (error) {
    console.error("Error fetching existing data:", error);
    process.exit(1);
}

// 2. Normalize both datasets for comparison
// We need a unique key to compare. Usually 'code', 'id', or 'name'.
// Looking at the previous context, we don't have a guaranteed unique ID in the raw JSON unless we generate it.
// However, typically we compare content. 
// Let's assume we compare based on a composite key or a specific field if available.
// If the goal is "if the data doesnt exist", we need to define what "data" means identity-wise.
// For drugs, maybe "BNF Code" or "Drug Name"?
// Let's use 'bnf_code' (normalized) if available, otherwise strict equality of the whole object might be too expensive.

// Let's create a Set of existing identifiers/signatures for fast lookup.
// Assuming normalized keys will produce consistent fields like 'bnf_code' or 'drug_name'.
const existingSignatures = new Set(existingData.map(item => {
    // Adjust this key based on what uniquely identifies a drug record
    // Using JSON.stringify of the normalized object is safest for "exact match" check
    // But IDs usually differ (API generates ID). 
    // Let's rely on a specific business key if possible. 
    // If not, we might check if 'bnf_code' exists.
    return item.bnf_code || item.drug_name || JSON.stringify(item);
}));

// 3. Filter local data to find new items
console.log("Filtering new items...");
const newItems = localData.filter(rawItem => {
    const normalizedItem = normalizeKeys(rawItem);
    
    // Explicitly cast bnf_code to string if it exists
    if (normalizedItem.bnf_code) {
        normalizedItem.bnf_code = String(normalizedItem.bnf_code);
    }
    
    const signature = normalizedItem.bnf_code || normalizedItem.drug_name || JSON.stringify(normalizedItem);
    return !existingSignatures.has(signature);
});

console.log(`Found ${newItems.length} new items to sync.`);

if (newItems.length === 0) {
    console.log("No new items to push.");
    process.exit(0);
}

// 4. Push new items in batches
const BATCH_SIZE = 50;
console.log(`Starting processing of ${newItems.length} items...`);

for (let i = 0; i < newItems.length; i += BATCH_SIZE) {
    // Check if we hit a 5000 request milestone (every 100 batches of 50)
    if (i > 0 && i % 5000 === 0) {
        console.log("Hit 5000 requests. Pausing for 60 seconds...");
        await new Promise(resolve => setTimeout(resolve, 60000));
        console.log("Resuming...");
    }

    const chunk = newItems.slice(i, i + BATCH_SIZE);
    
    await Promise.all(chunk.map(async (item: any) => {
       try {
            const payload = normalizeKeys(item);
            
            // Explicitly cast bnf_code to string if it exists
            if (payload.bnf_code) {
                payload.bnf_code = String(payload.bnf_code);
            }
            
            const response = await fetch(`${api_url}/api/${Resource}s`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                 const errorBody = await response.text();
                 console.error("API Error Body:", errorBody);
            }
        } catch (error) {
            console.error("Error pushing item:", error);
        }
    }));

    console.log(`Processed ${Math.min(i + BATCH_SIZE, newItems.length)}/${newItems.length}`);
}

const api_url = process.env.SAPI_URL
const token = process.env.SAPI_KEY
const Resource = "Condition" // Adjust this to match your API resource name (e.g. "Condition", "ICD10Code", etc.)

import { file } from "bun"

// 1. Load Local Data
const localData = await file("./data/us-standard/grouping/icd10cm_grouped.json").json() as any[];
console.log(`Loaded ${localData.length} items from local file.`);

// 2. Helper to fetch all existing resources
const getAllResources = async () => {
    // If your API supports pagination, you might need to loop here.
    // For now, assuming a simple GET returns everything or the data we need.
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

// 3. Helper to normalize keys (if needed) or prepare for comparison
const normalizeItem = (item: any) => {
    // If you need specific normalization (like converting keys to snake_case), do it here.
    // For now, returning the item as is, assuming the local JSON is already in the correct format 
    // for the API (based on your previous grouping script).
    return item;
}

// 4. Main Sync Logic
const syncData = async () => {
    let existingData: any[] = [];
    try {
        console.log("Fetching existing data from API...");
        const apiResponse = await getAllResources() as any;
        
        if (apiResponse && Array.isArray(apiResponse.data)) {
            existingData = apiResponse.data;
        } else if (Array.isArray(apiResponse)) {
            existingData = apiResponse;
        }
        console.log(`Fetched ${existingData.length} existing items from API.`);
    } catch (error) {
        console.error("Error fetching existing data:", error);
        // We might choose to proceed assuming 0 existing items if fetch failed 
        // OR exit. Exiting is safer to avoid duplicates.
        process.exit(1);
    }

    // Create a Set of existing unique identifiers
    // Using 'icd10_code' as the unique key based on your previous schema
    const existingCodes = new Set(existingData.map(item => item.icd10_code));

    // Filter for new items
    console.log("Comparing data...");
    const newItems = localData.filter(item => !existingCodes.has(item.icd10_code));

    console.log(`Found ${newItems.length} new items to sync.`);

    if (newItems.length === 0) {
        console.log("No new items to push.");
        return;
    }

    // Push new items in batches
    const BATCH_SIZE = 50;
    console.log(`Starting push of ${newItems.length} items...`);

    // Helper for delay
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    for (let i = 0; i < newItems.length; i += BATCH_SIZE) {
        // Rate limiting pause
        if (i > 0 && i % 5000 === 0) {
            console.log("Hit 5000 requests. Pausing for 60 seconds...");
            await sleep(60000);
            console.log("Resuming...");
        }

        const chunk = newItems.slice(i, i + BATCH_SIZE);
        
        await Promise.all(chunk.map(async (item: any) => {
            try {
                const response = await fetch(`${api_url}/api/${Resource}s`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify(normalizeItem(item))
                });

                if (!response.ok) {
                    const errorBody = await response.text();
                    console.error(`Error pushing ${item.icd10_code}: ${errorBody}`);
                }
            } catch (error) {
                console.error(`Network error pushing ${item.icd10_code}:`, error);
            }
        }));

        console.log(`Processed ${Math.min(i + BATCH_SIZE, newItems.length)}/${newItems.length}`);
    }
}

// Run the sync
syncData();

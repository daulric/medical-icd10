const Resource = "Medication"
const api_url = process.env.SAPI_URL
const token = process.env.SAPI_KEY
const path = "./data/drugs/PCA Mar21.json"

import { file } from "bun"

const data = await file(path).json()

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

const BATCH_SIZE = 50;
console.log(`Starting processing of ${data.length} items...`);

for (let i = 0; i < data.length; i += BATCH_SIZE) {
    // Check if we hit a 5000 request milestone (every 100 batches of 50)
    if (i > 0 && i % 5000 === 0) {
        console.log("Hit 5000 requests. Pausing for 60 seconds...");
        await new Promise(resolve => setTimeout(resolve, 60000));
        console.log("Resuming...");
    }

    const chunk = data.slice(i, i + BATCH_SIZE);
    
    await Promise.all(chunk.map(async (item: any) => {
        //console.log(normalizeKeys(item))
       try {
            const response = await fetch(`${api_url}/api/${Resource}s`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(normalizeKeys(item))
            });

            if (!response.ok) {
                 const errorBody = await response.text();
                 console.error("API Error Body:", errorBody);
                 // throw new Error(`Failed to send data: ${response.statusText}`);
            }
        } catch (error) {
            console.error("Error pushing item:", error);
        }
    }));

    console.log(`Processed ${Math.min(i + BATCH_SIZE, data.length)}/${data.length}`);
}
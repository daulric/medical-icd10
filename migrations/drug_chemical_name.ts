import { file } from "bun"

const path = "./data/drugs/PCA Mar21.json"

const data = await file(path).json()

const chemicalNames = [...new Set(data.map((item: any) => item["BNF Chemical Name"]))];

console.log(chemicalNames.length, (chemicalNames))

const API_URL = process.env.SAPI_URL
const token = process.env.SAPI_KEY
const Resource = "Lookup"
const category: string = "category"

const createLookup = async (category: string, name: string) => {
    const response = await fetch(`${API_URL}/api/${Resource}s`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ category: "lookupcategory-6c82896f-b07b-44f1-b778-a1af5ac13a17", label: name, value: name })
    })
    
    if (!response.ok) {
        throw new Error(`Failed to create lookup: ${response.statusText}`);
    }
    
    return response.json()
}

const BATCH_SIZE = 50;
console.log(`Starting processing of ${chemicalNames.length} items...`);

for (let i = 0; i < chemicalNames.length; i += BATCH_SIZE) {
    const chunk = chemicalNames.slice(i, i + BATCH_SIZE);
    
    await Promise.all(chunk.map(async (chemicalName: string) => {
        try {
            await createLookup(category, chemicalName);
        } catch (error) {
            console.error(`Error creating lookup for ${chemicalName}:`, error);
        }
    }));
    
    console.log(`Processed ${Math.min(i + BATCH_SIZE, chemicalNames.length)}/${chemicalNames.length}`);
}
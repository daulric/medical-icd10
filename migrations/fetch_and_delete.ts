import { file, write } from "bun";

const api_url = process.env.SAPI_URL
const api_key = process.env.SAPI_KEY
const Resource = "Procedure"

const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${api_key}`
}

const total_data = await fetch(`${api_url}/api/${Resource}s`, {
    headers
})

if (!total_data.ok) {
    throw new Error(`Failed to fetch total data: ${total_data.statusText}`);
}
const total_data_json = await total_data.json() as Record<string, any>;

// look for total_data_json.data.length and if it is not 0, then delete the data
if (total_data_json.data.length > 0) {
    console.log(`Deleting ${total_data_json.data.length} items...`);
    await Promise.all(total_data_json.data.map(async (item: any) => {
        await fetch(`${api_url}/api/${Resource}s/${item.id}`, {
            method: "DELETE",
            headers,
        });
        console.log(`Deleted ${item.id}`);
    }));   
}
const Resource = "Medication"
const api_url = process.env.SAPI_URL
const token = process.env.SAPI_KEY

const deleteDrug = async (chemicalName: string) => {
    const response = await fetch(`${api_url}/api/${Resource}s/${chemicalName}`, {
        method: "DELETE",
        headers: {
            "Authorization": `Bearer ${token}`
        }
    })
    return response.json()
}

const getAllDrugs = async () => {
    const response = await fetch(`${api_url}/api/${Resource}s`, {
        headers: {
            "Authorization": `Bearer ${token}`
        }
    })
    return response.json()
}

const drugdata = await getAllDrugs() as any;

const BATCH_SIZE = 50;
console.log(`Starting deletion of ${drugdata.data.length} items...`);

for (let i = 0; i < drugdata.data.length; i += BATCH_SIZE) {
    const chunk = drugdata.data.slice(i, i + BATCH_SIZE);
    
    await Promise.all(chunk.map(async (item: any) => {
        try {
            // console.log(`Deleting ${item.id}`);
            await deleteDrug(item.id);
        } catch (error) {
            console.error(`Error deleting ${item.id}:`, error);
        }
    }));
    
    console.log(`Deleted ${Math.min(i + BATCH_SIZE, drugdata.data.length)}/${drugdata.data.length}`);
}
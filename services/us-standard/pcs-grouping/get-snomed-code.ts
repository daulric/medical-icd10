export async function getSnomedCode(pcsCode: string, description: string) {
    const key = process.env['bio-portal-key'];
    const classUri = encodeURIComponent(`http://purl.bioontology.org/ontology/ICD10PCS/${pcsCode}`);
    
    // TIER 1: Try exact Mapping
    try {
        const mapResponse = await fetch(`https://data.bioontology.org/ontologies/ICD10PCS/classes/${classUri}/mappings?apikey=${key}`);
        const mappings = await mapResponse.json() as any[];

        for (const mapObj of mappings) {
            const snomedClass = mapObj.classes.find((c: any) => c.links.ontology.includes("SNOMEDCT"));
            if (snomedClass) return snomedClass.id.split('/').pop(); 
        }

        // TIER 2: Fallback to Search if Mapping is empty
        // We search only within SNOMEDCT for the procedure description
        const searchUrl = `https://data.bioontology.org/search?q=${encodeURIComponent(description)}&ontologies=SNOMEDCT&require_exact_match=false&apikey=${key}`;
        const searchResponse = await fetch(searchUrl);
        const searchData = await searchResponse.json() as any;

        if (searchData.collection && searchData.collection.length > 0) {
            // Return the first (most relevant) result
            return searchData.collection[0]['@id'].split('/').pop();
        }

        return "NO_MATCH_FOUND";
    } catch (error) {
       // console.error(`Error processing ${pcsCode}:`, error);
        return "ERROR";
    }
}

import { file } from "bun";

async function main() {
    const data = await file("./data/us-standard/grouping/pcs-grouped.json").json();
    
    // Flatten items for processing
    const allItems: any[] = [];
    for (const group of data) {
        if (group.specification_codes && Array.isArray(group.specification_codes)) {
            for (const item of group.specification_codes) {
                allItems.push(item);
            }
        }
    }

    // Process with concurrency limit to avoid API rate limits/errors
    const CONCURRENCY = 10;
    const results = [];
    
    for (let i = 0; i < allItems.length; i += CONCURRENCY) {
        const batch = allItems.slice(i, i + CONCURRENCY);
        const batchPromises = batch.map(item => 
            getSnomedCode(item.code, item.long_description).then(result => {
                item.snomed_ct_code = result;
                console.log(`Result for ${item.code}: ${result}`);
            })
        );
        await Promise.all(batchPromises);
    }
    
    await file("./data/us-standard/grouping/pcs-grouped-with-snomed-ct-code.json").write(JSON.stringify(data, null, 2));
}

main();

// Example usage with your specific code
//const pcsCode = "0016070";
//const description = "Bypass Cerebral Ventricle to Nasopharynx with Autologous Tissue Substitute, Open Approach";

//const result = await getSnomedCode(pcsCode, description);
//console.log(`Result for ${pcsCode}: ${result}`);
// Likely returns: 417435003 (Ventriculonasopharyngeal shunt)
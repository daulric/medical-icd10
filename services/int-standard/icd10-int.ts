import { apiUrl, credentials } from "../../db/keys";
import Bun from "bun";

// getting access token
const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
        "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: credentials.apiKey,
        client_secret: credentials.apiSecret,
        scope: "icdapi_access",
    }),
});

// Check if token request was successful
if (!response.ok) {
    console.error("Token request failed:", response.status, response.statusText);
    const errorText = await response.text();
    console.error("Error:", errorText);
    //process.exit(1);
}

const data = await response.json();
const accessToken = (data as { access_token: string })?.access_token;

async function main(url: string) {
    const response = await fetch(url, {
        headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Accept": "application/json",
            "API-Version": "v2",
            "Accept-Language": "en"
        },
    });
    if (!response.ok) {
        console.error("Test data request failed:", response.status, response.statusText);
        const errorText = await response.text();
        console.error("Error:", errorText);
    }

   const data = await response.json() as any;

   if (data.child) {
    const childUrls = data.child.map(child => child.replace("http://", "https://"));
    //console.log("Executing child URLs:", (childUrls || []).join(", "));
    const childData = await Promise.all(childUrls.map(childUrl => main(childUrl)));
    return childData;
   }
   
   return data;
}

function extractData(items: any[]): any[] {
    let result: any[] = [];

    function traverse(item: any) {
        if (Array.isArray(item)) {
            item.forEach(traverse);
        } else if (item && typeof item === 'object') {
            if (item.code && item.title && item.title["@value"]) {
                result.push({
                    code: item.code,
                    title: item.title["@value"]
                });
            }
        }
    }

    traverse(items);
    return result;
}

export default async function defaultMain() {
    const finalData = await main("https://id.who.int/icd/release/10/2019");
    console.log("Final data fetched");

    console.log("Extracting data...");
    const extractedData = extractData(finalData);
    Bun.write("./data/int-standard/icd10-int.json", JSON.stringify(extractedData, null, 2));
    console.log(`- Saved ${extractedData.length} codes to ./data/int-standard/icd10-int.json`);
    console.log("--------------------------------");
}

if (import.meta.main) {
    await defaultMain();
}
import { apiUrl, credentials } from "../../db/keys";
import Bun from "bun";


const START_URL = "https://id.who.int/icd/release/10/2019";
const CONCURRENCY_LIMIT = 5000; 
const OUT_FILE = "./data/int-standard/icd10-int.json";


async function getAccessToken() {
    console.log("🔑 Authenticating...");
const response = await fetch(apiUrl, {
    method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: credentials.apiKey,
        client_secret: credentials.apiSecret,
        scope: "icdapi_access",
    }),
});

    if (!response.ok) throw new Error(`Token failed: ${response.status}`);
    const data = await response.json();
    return (data as { access_token: string })?.access_token;
}

export default async function defaultMain() {
    const token = await getAccessToken();
    const results: any[] = [];
    
    let active = 0;
    const queue: (() => Promise<void>)[] = [];

    const run = async (fn: () => Promise<void>) => {
        if (active < CONCURRENCY_LIMIT) {
            active++;
            fn().finally(() => {
                active--;
                if (queue.length > 0) {
                    const next = queue.shift();
                    if (next) run(next);
                }
            });
        } else {
            queue.push(fn);
        }
    };

    async function fetchNode(url: string, retryCount = 0) {
        try {
            const res = await fetch(url, {
        headers: {
                    "Authorization": `Bearer ${token}`,
            "Accept": "application/json",
            "API-Version": "v2",
            "Accept-Language": "en"
                }
            });

            // HANDLE RATE LIMITING (429) & ERRORS
            if (res.status === 429) {
                // Back off if we are hitting them too hard
                console.warn(`\n⚠️ Hit Rate Limit. Waiting 5s... (Active: ${active})`);
                await Bun.sleep(5000); 
                return run(() => fetchNode(url, retryCount + 1)); // Retry
            }

            if (!res.ok) {
                console.error(`\n❌ Failed: ${url} (${res.status})`);
                return;
    }

            const data = await res.json() as any;

            if (data.code && data.title && data.title["@value"]) {
                results.push({
                    code: data.code,
                    title: data.title["@value"]
                });
                
                if (results.length % 500 === 0) {
                    process.stdout.write(`\r🚀 Collected: ${results.length} codes...`);
                }
            }

            if (data.child && Array.isArray(data.child)) {
                for (const childUrl of data.child) {
                    const secureUrl = childUrl.replace("http://", "https://");
                    run(() => fetchNode(secureUrl));
}
            }

        } catch (e) {
            console.error(`Error: ${url}`, e);
        }
    }

    console.log("🌍 Starting High-Speed Crawler...");
    const start = performance.now();

    await new Promise<void>((resolve) => {
        run(() => fetchNode(START_URL));
        
        const checkDone = setInterval(() => {
            if (active === 0 && queue.length === 0) {
                clearInterval(checkDone);
                resolve();
            }
        }, 100);
    });

    const end = performance.now();
    console.log(`\n\n✅ Done in ${((end - start) / 1000).toFixed(2)}s`);

    results.sort((a, b) => a.code.localeCompare(b.code));

    console.log("💾 Saving data...");
    await Bun.write(OUT_FILE, JSON.stringify(results, null, 2));
    console.log(`- Saved ${results.length} codes to ${OUT_FILE}`);
}

if (import.meta.main) {
    await defaultMain();
}
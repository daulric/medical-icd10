import { JSDOM } from "jsdom";
import AdmZip from "adm-zip";
import { write } from "bun";

const CMS_URL = "https://www.cms.gov/medicare/coding-billing/icd-10-codes";

async function main() {
  const today = new Date();
  const currentMonth = today.getMonth(); // 0 = Jan, 3 = April, 9 = Oct
  const currentYear = today.getFullYear();

  // --- LOGIC: ADJUST AROUND OCT 1st & APRIL 1st ---
  
  let targetYear = currentYear;
  let preferApril = false;

  // Rule 1: October 1st (Fiscal Year Update)
  // If it's Oct, Nov, or Dec, we want the NEXT year's codes.
  if (currentMonth >= 9) {
    targetYear = currentYear + 1;
    console.log(`- Current date is post-October. Targeting FY ${targetYear} Annual release.`);
  } else {
    // We are in Jan - Sept, so the Fiscal Year is the current calendar year.
    console.log(`- Current date is pre-October. Targeting FY ${targetYear}.`);
    
    // Rule 2: April 1st (Interim Update)
    // Only applies if we haven't already jumped to the next FY (i.e., we are in Apr-Sept)
    if (currentMonth >= 3) {
      preferApril = true;
      console.log("- It is past April 1st. Will prioritize 'April 1' update files if found.");
    }
  }
  // ------------------------------------------------

  console.log(`- Scraping CMS for ${targetYear} ICD-10-PCS Order File...`);

  const response = await fetch(CMS_URL);
  const html = await response.text();
  const dom = new JSDOM(html);
  const document = dom.window.document;

  // Find all potential download links
  const links = Array.from(document.querySelectorAll("a")) as any[];
  
  // Filter for links that match our Target Year and look like zip files
  const candidates = links.filter((a) => {
    const text = a.textContent?.toLowerCase() || "";
    return (
      text.includes(targetYear.toString()) &&
      text.includes("icd-10-pcs") &&
      text.includes("order file") &&
      a.href.endsWith(".zip")
    );
  });

  if (candidates.length === 0) {
    console.error(`❌ No files found for ${targetYear}. CMS might not have released them yet.`);
    return;
  }

  // Select the best link based on our "preferApril" logic
  let bestLink = candidates.find(a => a.textContent.toLowerCase().includes("april"));
  
  if (preferApril && bestLink) {
    console.log("- Found April Update file!");
  } else {
    // If we don't want April, OR we couldn't find an April file, grab the standard one.
    // Usually, the standard one does NOT say "April" (or says "Annual").
    // We sort to find the one that doesn't say "April" if possible, or just take the first one.
    if (preferApril) console.log("- Wanted April update but couldn't find it. Falling back to Annual.");
    
    // Fallback: Find one that usually represents the main annual file (often just "202X ICD-10-PCS Order File")
    bestLink = candidates.find(a => !a.textContent.toLowerCase().includes("april")) || candidates[0];
  }

  const downloadUrl = bestLink.href.startsWith("http")
    ? bestLink.href
    : `https://www.cms.gov${bestLink.href}`;

  console.log(`⬇ Downloading: ${downloadUrl}`);

  // --- DOWNLOAD & PARSE (Same as before) ---
  const zipRes = await fetch(downloadUrl);
  if (!zipRes.ok) throw new Error(`Failed to download: ${zipRes.statusText}`);
  const arrayBuffer = await zipRes.arrayBuffer();
  
  const zip = new AdmZip(Buffer.from(arrayBuffer));
  const orderFile = zip.getEntries().find((entry) => 
    entry.entryName.includes("order") && entry.entryName.endsWith(".txt")
  );

  if (!orderFile) {
    console.error("❌ ZIP downloaded, but text file not found inside.");
    return;
  }

  console.log(`- Processing: ${orderFile.entryName}`);
  const fileContent = orderFile.getData().toString("utf8");
  
  const codes = [];
  const lines = fileContent.split(/\r?\n/);

  for (const line of lines) {
    if (line.length < 20) continue;
    codes.push({
      code: line.substring(6, 13).trim(),
      isHeader: line.substring(14, 15) === "1",
      shortDescription: line.substring(16, 76).trim(),
      longDescription: line.substring(77).trim(),
    });
  }

  const filename = `./data/us-standard/icd10pcs_${targetYear}${preferApril ? "_april" : ""}.json`;
  await write(filename, JSON.stringify(codes, null, 2));
  console.log(`- Saved ${codes.length} codes to ${filename}`);
}

export default main;
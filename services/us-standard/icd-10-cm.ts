import { JSDOM } from "jsdom";
import AdmZip from "adm-zip";
import { write } from "bun";

const CMS_URL = "https://www.cms.gov/medicare/coding-billing/icd-10-codes";

async function main() {
  const today = new Date();
  const currentMonth = today.getMonth(); 
  const currentYear = today.getFullYear();

  // Smart Year Logic (Same as PCS)
  let targetYear = currentYear;
  if (currentMonth >= 9) targetYear = currentYear + 1;

  console.log(`🔍 Scraping CMS for ${targetYear} ICD-10-CM (Diagnoses)...`);

  const response = await fetch(CMS_URL);
  const html = await response.text();
  const dom = new JSDOM(html);
  const document = dom.window.document;

  const links = Array.from(document.querySelectorAll("a")) as any[];
  
  // 1. Find the "Code Descriptions in Tabular Order" ZIP
  const targetLink = links.find((a) => {
    const text = a.textContent?.toLowerCase() || "";
    return (
      text.includes(targetYear.toString()) &&
      text.includes("tabular order") && // This keyword is specific to the CM file
      a.href.endsWith(".zip")
    );
  });

  if (!targetLink) {
    console.error(`❌ Could not find ICD-10-CM file for ${targetYear}.`);
    return;
  }

  const downloadUrl = targetLink.href.startsWith("http")
    ? targetLink.href
    : `https://www.cms.gov${targetLink.href}`;

  console.log(`⬇️ Downloading: ${downloadUrl}`);

  const zipRes = await fetch(downloadUrl);
  if (!zipRes.ok) throw new Error(`Failed: ${zipRes.statusText}`);
  const arrayBuffer = await zipRes.arrayBuffer();
  
  // 2. Unzip and Parse
  const zip = new AdmZip(Buffer.from(arrayBuffer));
  const zipEntries = zip.getEntries();
  
  // The CM file is usually named "icd10cm_order_xxxx.txt"
  const orderFile = zipEntries.find((entry) => 
    entry.entryName.includes("order") && entry.entryName.endsWith(".txt")
  );

  if (!orderFile) {
    console.error("❌ Text file not found inside ZIP.");
    return;
  }

  console.log(`📂 Processing: ${orderFile.entryName}`);
  const fileContent = orderFile.getData().toString("utf8");
  
  // 3. Parse Logic (Specific to ICD-10-CM Order File)
  // Format:
  // Pos 6-13: Code (variable length, no dot)
  // Pos 14:   Header Flag (1=Header, 0=Valid)
  // Pos 16-76: Short Desc
  // Pos 77+:   Long Desc
  
  const codes = [];
  const lines = fileContent.split(/\r?\n/);

  for (const line of lines) {
    if (line.length < 20) continue;
    
    // Extract raw code
    let rawCode = line.substring(6, 13).trim();
    
    // Add dot for readability (Standard CM format: A00.0)
    // Rule: Dot after 3rd character if length > 3
    let formattedCode = rawCode;
    if (rawCode.length > 3) {
      formattedCode = rawCode.substring(0, 3) + "." + rawCode.substring(3);
    }

    codes.push({
      code: formattedCode,
      rawCode: rawCode, // Useful to keep the clean version
      isHeader: line.substring(14, 15) === "1",
      shortDescription: line.substring(16, 76).trim(),
      longDescription: line.substring(77).trim(),
    });
  }

  await write(`./data/us-standard/icd10cm_${targetYear}.json`, JSON.stringify(codes, null, 2));
  console.log(`✅ Saved ${codes.length} ICD-10-CM codes.`);
}

export default main;

if (import.meta.main) {
  await main();
}
import icd10CmMain from "./services/us-standard/icd-10-cm";
import icd10PcsMain from "./services/us-standard/icd-10-pcs";
import icd10IntMain from "./services/int-standard/icd10-int";

async function main() {
    await Promise.all([
        icd10CmMain(),
        icd10PcsMain(),
        icd10IntMain()
    ]);
}

await main();
console.log("All services completed");
import { MedicalEngine } from "../services/icd-10-code-merge";

const engine = new MedicalEngine();

console.log("Preparing benchmark...");
const startInit = performance.now();
await engine.init();
const endInit = performance.now();
console.log(`Init took ${(endInit - startInit).toFixed(2)}ms`);

function benchmark(name: string, fn: () => void, runs = 1000) {
    const start = performance.now();
    for (let i = 0; i < runs; i++) {
        fn();
    }
    const end = performance.now();
    const total = end - start;
    const avg = total / runs;
    const ops = 1000 / avg;
    console.log(`${name}:`);
    console.log(`  Total: ${total.toFixed(2)}ms for ${runs} runs`);
    console.log(`  Avg: ${avg.toFixed(4)}ms`);
    console.log(`  Ops/sec: ${Math.floor(ops).toLocaleString()}`);
    console.log("------------------------------------------------");
}

const benchmark_num = 1000;

console.log("\nStarting Benchmarks...\n");

benchmark("Search Condition ('fracture')", () => {
    engine.searchCondition("fracture");
}, benchmark_num);

benchmark("Search Condition ('cholera')", () => {
    engine.searchCondition("cholera");
}, benchmark_num);

benchmark("Search Condition ('medical examination' [Z00.0])", () => {
    engine.searchCondition("medical examination");
}, benchmark_num);

benchmark("Search Procedure ('appendectomy')", () => {
    engine.searchProcedure("appendectomy");
}, benchmark_num);

benchmark("Search Procedure ('destruction brain' [00500ZZ])", () => {
    engine.searchProcedure("destruction brain");
}, benchmark_num);

benchmark("Convert Bill to Report ('U85' - Worst Case)", () => {
    engine.convertBillToReport("U85");
}, benchmark_num);

benchmark("Convert Bill to Report ('A00.0')", () => {
    engine.convertBillToReport("A00.0");
}, benchmark_num);
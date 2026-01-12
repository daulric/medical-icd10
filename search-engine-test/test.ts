import { file } from "bun";
import { SearchEngine } from "../search-engine/engine";


const data = await file("search-engine-test/random-search-data.json").json() as any[];

const engine = SearchEngine.fromArray(data, "id", ["title", "description", "category"]);

const result = engine.search("database")

console.log(result.length, result)
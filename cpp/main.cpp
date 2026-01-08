#include <iostream>
#include <vector>
#include <string>
#include <string_view>
#include <unordered_map>
#include <fstream>
#include <sstream>
#include <algorithm>
#include <chrono>
#include <set>

// ---------------------------------------------------------
// Minimal JSON Parser (Fast & Simple for this specific schema)
// We rely on simple string searching because full JSON libraries
// might be heavy to include just for a benchmark demo.
// ---------------------------------------------------------
std::string extract_json_string(const std::string& line, const std::string& key) {
    std::string key_pattern = "\"" + key + "\": \"";
    size_t start = line.find(key_pattern);
    if (start == std::string::npos) return "";
    start += key_pattern.length();
    size_t end = line.find("\"", start);
    return line.substr(start, end - start);
}

// ---------------------------------------------------------
// Data Structures
// ---------------------------------------------------------
struct GlobalCode {
    std::string code;
    std::string title;
};

struct USDiagnosis {
    std::string code;
    std::string description;
    std::string parentCode;
};

struct USProcedure {
    std::string code;
    std::string description;
};

struct SearchResult {
    const GlobalCode* global;
    int billing_count;
};

// ---------------------------------------------------------
// The C++ Engine
// ---------------------------------------------------------
class MedicalEngine {
public:
    std::vector<GlobalCode> globalCodes;
    std::vector<USDiagnosis> usDiagnoses;
    std::vector<USProcedure> usProcedures;

    // Indexes
    std::unordered_map<std::string, const GlobalCode*> globalCodeMap;
    std::unordered_map<std::string, std::vector<const GlobalCode*>> globalTokenIndex;
    std::unordered_map<std::string, std::vector<const USDiagnosis*>> usChildrenIndex; // Root -> List
    std::unordered_map<std::string, std::vector<const USProcedure*>> proceduresIndex;

    MedicalEngine() {
        // Reserve memory to prevent reallocations
        globalCodes.reserve(15000);
        usDiagnoses.reserve(100000);
        usProcedures.reserve(100000);
    }

    // Tokenizer (Zero-copy string_view would be even faster, but std::string is safer for now)
    std::vector<std::string> tokenize(const std::string& text) {
        std::vector<std::string> tokens;
        std::string current;
        for (char c : text) {
            if (isalnum(c)) {
                current += tolower(c);
            } else if (!current.empty()) {
                if (current.length() > 2) tokens.push_back(current);
                current.clear();
            }
        }
        if (!current.empty() && current.length() > 2) tokens.push_back(current);
        return tokens;
    }

    void loadData() {
        std::cout << "⚙️  Loading Data (C++)..." << std::endl;
        
        // 1. Load Global Codes
        // NOTE: In a real C++ app, we'd use simdjson or nlohmann/json. 
        // Here we hack it for zero-dependency portability.
        // Assumes file format is pretty-printed or standard JSON array.
        loadGlobalJSON("../data/int-standard/icd10-int.json");
        
        // 2. Load US Diagnoses
        loadUSDiagJSON("../data/us-standard/icd10cm_2026.json");
        
        // 3. Load US Procedures
        loadUSProcJSON("../data/us-standard/icd10pcs_2026.json");

        // 4. Build Indexes
        buildIndexes();
        
        std::cout << "✅ Loaded: " << globalCodes.size() << " Global, " 
                  << usDiagnoses.size() << " US-CM, " 
                  << usProcedures.size() << " US-PCS." << std::endl;
    }

    void buildIndexes() {
        // Index Global Codes
        for (const auto& g : globalCodes) {
            globalCodeMap[g.code] = &g;

            auto tokens = tokenize(g.title);
            std::string lowerCode = g.code;
            std::transform(lowerCode.begin(), lowerCode.end(), lowerCode.begin(), ::tolower);
            tokens.push_back(lowerCode);

            // Dedup tokens
            std::sort(tokens.begin(), tokens.end());
            tokens.erase(std::unique(tokens.begin(), tokens.end()), tokens.end());

            for (const auto& t : tokens) {
                globalTokenIndex[t].push_back(&g);
            }
        }

        // Index US Children (Buckets)
        for (const auto& us : usDiagnoses) {
            std::string root = us.code.substr(0, 3);
            usChildrenIndex[root].push_back(&us);
        }

        // Index Procedures (Inverted)
        for (const auto& p : usProcedures) {
            auto tokens = tokenize(p.description);
            std::string lowerCode = p.code;
            std::transform(lowerCode.begin(), lowerCode.end(), lowerCode.begin(), ::tolower);
            tokens.push_back(lowerCode);

            std::sort(tokens.begin(), tokens.end());
            tokens.erase(std::unique(tokens.begin(), tokens.end()), tokens.end());

            for (const auto& t : tokens) {
                proceduresIndex[t].push_back(&p);
            }
        }
    }

    // O(1) Search Condition
    std::vector<SearchResult> searchCondition(const std::string& query) {
        auto tokens = tokenize(query);
        if (tokens.empty()) return {};

        std::vector<const GlobalCode*> candidates;

        // 1. First word matches
        if (globalTokenIndex.count(tokens[0])) {
            candidates = globalTokenIndex[tokens[0]];
        } else {
            return {};
        }

        // 2. Intersect remaining words
        for (size_t i = 1; i < tokens.size(); ++i) {
            if (candidates.empty()) break;
            if (globalTokenIndex.count(tokens[i]) == 0) {
                return {};
            }
            
            const auto& nextMatches = globalTokenIndex[tokens[i]];
            std::vector<const GlobalCode*> intersection;
            
            // Simple intersection logic (assume sorted for faster intersection in prod, here brute force is fine for small N)
            // Or use a set.
            std::set<const GlobalCode*> nextSet(nextMatches.begin(), nextMatches.end());
            
            for (auto c : candidates) {
                if (nextSet.count(c)) intersection.push_back(c);
            }
            candidates = intersection;
        }

        // Limit to 5
        if (candidates.size() > 5) candidates.resize(5);

        std::vector<SearchResult> results;
        for (auto g : candidates) {
            // Get children count
            std::string root = g->code.substr(0, 3);
            int count = 0;
            if (usChildrenIndex.count(root)) {
                // In exact logic we filter startsWith, but for speed bench we'll trust the bucket or do a quick check
                const auto& bucket = usChildrenIndex[root];
                // Count actual startsWith matches
                for(auto child : bucket) {
                    if (child->code.rfind(g->code, 0) == 0) count++;
                }
            }
            results.push_back({g, count});
        }
        return results;
    }

    // O(1) Search Procedure
    std::vector<const USProcedure*> searchProcedure(const std::string& query) {
        auto tokens = tokenize(query);
        if (tokens.empty()) return {};

        std::vector<const USProcedure*> candidates;
        if (proceduresIndex.count(tokens[0])) {
            candidates = proceduresIndex[tokens[0]];
        } else {
            return {};
        }

        for (size_t i = 1; i < tokens.size(); ++i) {
            if (candidates.empty()) break;
            const auto& nextMatches = proceduresIndex[tokens[i]];
            std::set<const USProcedure*> nextSet(nextMatches.begin(), nextMatches.end());
            std::vector<const USProcedure*> intersection;
            for (auto c : candidates) {
                if (nextSet.count(c)) intersection.push_back(c);
            }
            candidates = intersection;
        }
        if (candidates.size() > 5) candidates.resize(5);
        return candidates;
    }

    // O(1) Conversion
    std::string convertBillToReport(const std::string& usCode) {
        if (globalCodeMap.count(usCode)) return globalCodeMap[usCode]->title;
        
        size_t dotPos = usCode.find('.');
        if (dotPos != std::string::npos) {
            std::string root = usCode.substr(0, dotPos);
            if (globalCodeMap.count(root)) return globalCodeMap[root]->title;
        } else {
             // In case there's no dot but it's not found (unlikely for root codes), try strict root 3 chars
             if (usCode.length() > 3) {
                 std::string root = usCode.substr(0, 3);
                 if (globalCodeMap.count(root)) return globalCodeMap[root]->title;
             }
        }
        return "";
    }

private:
    void loadGlobalJSON(const std::string& path) {
        std::ifstream file(path);
        std::string line;
        while (std::getline(file, line)) {
            if (line.find("code") != std::string::npos) {
                GlobalCode g;
                g.code = extract_json_string(line, "code");
                std::getline(file, line); // Next line usually title
                g.title = extract_json_string(line, "title");
                if (!g.code.empty()) globalCodes.push_back(g);
            }
        }
    }

    void loadUSDiagJSON(const std::string& path) {
        std::ifstream file(path);
        std::string line;
        while (std::getline(file, line)) {
            if (line.find("code") != std::string::npos) {
                USDiagnosis u;
                u.code = extract_json_string(line, "code");
                // skip rawCode, isHeader
                while(line.find("longDescription") == std::string::npos && std::getline(file, line));
                u.description = extract_json_string(line, "longDescription");
                if (!u.code.empty()) usDiagnoses.push_back(u);
            }
        }
    }

    void loadUSProcJSON(const std::string& path) {
        std::ifstream file(path);
        std::string line;
        while (std::getline(file, line)) {
            if (line.find("code") != std::string::npos) {
                USProcedure p;
                p.code = extract_json_string(line, "code");
                while(line.find("longDescription") == std::string::npos && std::getline(file, line));
                p.description = extract_json_string(line, "longDescription");
                if (!p.code.empty()) usProcedures.push_back(p);
            }
        }
    }
};

// ---------------------------------------------------------
// Benchmarking
// ---------------------------------------------------------
template <typename Func>
void benchmark(const std::string& name, Func func, int runs) {
    auto start = std::chrono::high_resolution_clock::now();
    for (int i = 0; i < runs; ++i) {
        func();
    }
    auto end = std::chrono::high_resolution_clock::now();
    std::chrono::duration<double, std::milli> ms = end - start;
    
    double avg = ms.count() / runs;
    double ops = 1000.0 / avg;

    std::cout << name << ":" << std::endl;
    std::cout << "  Total: " << ms.count() << "ms for " << runs << " runs" << std::endl;
    std::cout << "  Avg: " << avg << "ms" << std::endl;
    std::cout << "  Ops/sec: " << (long long)ops << std::endl;
    std::cout << "------------------------------------------------" << std::endl;
}

int main() {
    MedicalEngine engine;
    
    auto start = std::chrono::high_resolution_clock::now();
    engine.loadData();
    auto end = std::chrono::high_resolution_clock::now();
    std::chrono::duration<double, std::milli> initTime = end - start;
    std::cout << "Init took " << initTime.count() << "ms" << std::endl << std::endl;

    int benchmark_num = 1000;

    benchmark("Search Condition ('cholera')", [&]() {
        auto res = engine.searchCondition("cholera");
        // prevent optimizer from removing code
        if(res.empty()) volatile int x = 0; 
    }, benchmark_num); // 1 Million Runs

    benchmark("Search Procedure ('appendectomy')", [&]() {
        auto res = engine.searchProcedure("appendectomy");
        if(res.empty()) volatile int x = 0;
    }, benchmark_num); // 1 Million Runs

    benchmark("Convert Bill ('A00.0')", [&]() {
        auto res = engine.convertBillToReport("A00.0");
        if(res.empty()) volatile int x = 0;
    }, benchmark_num); // 1 Million Runs

    return 0;
}


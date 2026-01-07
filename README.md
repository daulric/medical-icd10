# ICD Services

This project provides a suite of tools to fetch, parse, and standardize medical classification codes into structured JSON formats. It supports both US-specific standards (CMS) and international standards (WHO).

## Features

- **ICD-10-CM (Clinical Modification):** Scrapes and processes diagnosis codes from the US Centers for Medicare & Medicaid Services (CMS).
- **ICD-10-PCS (Procedure Coding System):** Scrapes and processes procedure codes from CMS.
- **WHO ICD-10:** Fetches international standard codes via the World Health Organization API.
- **Automated Updates:** Logic to determine the correct fiscal year (Oct 1st) and interim updates (April 1st) for US codes.

## Prerequisites

- [Bun](https://bun.sh/) runtime installed.

## Installation

Install the project dependencies:

```bash
bun install
```

## Configuration

This project requires access to the WHO ICD API for fetching international standards.

👉 **[Read the API Setup Guide](ICD_API_SETUP.md)** to obtain your Client ID and Secret and configure the `db/keys.ts` file.

## Usage

### Run All Services

To fetch and update all datasets (US and International):

```bash
bun run main.ts
```

### Run Individual Services

You can also run specific services independently:

```bash
# US ICD-10-CM (Diagnoses)
bun run services/us-standard/icd-10-cm.ts

# US ICD-10-PCS (Procedures)
bun run services/us-standard/icd-10-pcs.ts

# International ICD-10 (WHO)
bun run services/int-standard/icd10-int.ts
```

## Output

Processed data is saved to the `data/` or root directory as JSON files (e.g., `icd10cm_2026.json`, `icd10-int.json`).


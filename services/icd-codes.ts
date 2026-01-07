export async function getIcdCodeByMedicalTermDiagnosis(name: string) {
    const response = await fetch(`https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search?sf=code,name&terms=${name}`);
    const data = await response.json();
    return data;
}

export async function getIcdCodeByMedicalTermProcedure(name: string) {
    const response = await fetch(`https://clinicaltables.nlm.nih.gov/api/icd10pcs/v3/search?sf=code,name&terms=${name}`);
    const data = await response.text();
    return data;
}
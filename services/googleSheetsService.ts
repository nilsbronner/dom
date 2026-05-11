
/**
 * Service pour récupérer les données depuis Google Sheets
 */

export const GOOGLE_SHEET_URL = "https://docs.google.com/spreadsheets/d/1UJrNyzwE5Haov1cS5Ylxa4ghJuRHKTjqWN_rzO-M9CE/export?format=csv";

export async function fetchSheetData(): Promise<string> {
  try {
    const response = await fetch(GOOGLE_SHEET_URL);
    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }
    const csvText = await response.text();
    return csvText;
  } catch (error) {
    console.error("Erreur lors de la récupération de la Google Sheet:", error);
    throw error;
  }
}

/**
 * Parse sommaire du CSV pour affichage rapide si besoin
 */
export function parseCSV(csv: string): any[] {
  const lines = csv.split('\n');
  if (lines.length === 0) return [];
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const result = [];
  
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const currentLine = lines[i].split(',');
    const obj: any = {};
    headers.forEach((header, index) => {
      obj[header] = currentLine[index]?.trim().replace(/"/g, '');
    });
    result.push(obj);
  }
  
  return result;
}


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

function splitCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

export function parseCSV(csv: string): any[] {
  const lines = csv.split('\n');
  if (lines.length === 0) return [];

  const headers = splitCSVLine(lines[0]);
  const result = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = splitCSVLine(lines[i]);
    const obj: any = {};
    headers.forEach((header, index) => {
      obj[header] = values[index] ?? '';
    });
    result.push(obj);
  }

  return result;
}

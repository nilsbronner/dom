
/**
 * Service pour récupérer les données depuis Google Sheets.
 * Parser CSV state-machine : gère correctement les champs multi-lignes entre guillemets.
 */

export const GOOGLE_SHEET_URL = "https://docs.google.com/spreadsheets/d/1UJrNyzwE5Haov1cS5Ylxa4ghJuRHKTjqWN_rzO-M9CE/export?format=csv";

export async function fetchSheetData(): Promise<string> {
  try {
    const response = await fetch(GOOGLE_SHEET_URL);
    if (!response.ok) throw new Error(`Erreur HTTP: ${response.status}`);
    return await response.text();
  } catch (error) {
    console.error("Erreur lors de la récupération de la Google Sheet:", error);
    throw error;
  }
}

/**
 * Parser CSV qui gère :
 * - champs entre guillemets contenant des virgules
 * - champs multi-lignes (retours à la ligne à l'intérieur des guillemets)
 * - guillemets échappés ("" à l'intérieur d'un champ quoté)
 * - CRLF et LF
 */
function parseCSVRaw(csv: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    const next = csv[i + 1];

    if (inQuotes) {
      if (ch === '"') {
        if (next === '"') {
          // Guillemet échappé
          currentField += '"';
          i++;
        } else {
          // Fin du champ quoté
          inQuotes = false;
        }
      } else {
        currentField += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        currentRow.push(currentField);
        currentField = '';
      } else if (ch === '\r' && next === '\n') {
        // CRLF
        currentRow.push(currentField);
        rows.push(currentRow);
        currentField = '';
        currentRow = [];
        i++;
      } else if (ch === '\n' || ch === '\r') {
        // LF ou CR seul
        currentRow.push(currentField);
        rows.push(currentRow);
        currentField = '';
        currentRow = [];
      } else {
        currentField += ch;
      }
    }
  }

  // Push the last field/row if non-empty
  if (currentField !== '' || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
}

export function parseCSV(csv: string): Record<string, string>[] {
  const rows = parseCSVRaw(csv);
  if (rows.length === 0) return [];

  const headers = rows[0].map((h) => h.trim());
  const result: Record<string, string>[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    // Skip rows that are entirely empty (last empty line of CSV)
    if (row.length === 1 && row[0].trim() === '') continue;
    if (row.every((c) => c.trim() === '')) continue;

    const obj: Record<string, string> = {};
    headers.forEach((header, idx) => {
      obj[header] = (row[idx] ?? '').trim();
    });
    result.push(obj);
  }

  return result;
}

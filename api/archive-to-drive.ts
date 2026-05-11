import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDriveClient } from "./_lib/clients";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method not allowed" });

  const { clientName, clientData } = req.body as { clientName: string; clientId?: string; clientData: any };
  const drive = getDriveClient();

  if (!drive) {
    return res.status(400).json({
      success: false,
      error: "Google Drive non configuré. Ajoutez GOOGLE_SERVICE_ACCOUNT_EMAIL et GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY dans votre .env",
    });
  }

  try {
    const parentFolderId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID || "1KPPA5zcvLFVPdvPFDaHkJgVfAePVLGMj";

    const folder = await drive.files.create({
      requestBody: {
        name: `CLIENT - ${clientName}`,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentFolderId],
      },
      fields: "id, webViewLink",
    });

    const folderId = folder.data.id!;
    const folderUrl = folder.data.webViewLink!;

    await drive.files.create({
      requestBody: {
        name: "RESUME_CLIENT.json",
        parents: [folderId],
      },
      media: {
        mimeType: "application/json",
        body: JSON.stringify(clientData, null, 2),
      },
      fields: "id",
    });

    res.json({ success: true, folderId, folderUrl, message: `Dossier Drive créé pour ${clientName}` });
  } catch (error: any) {
    console.error("Drive Archive Error:", error.message);
    const msg = error.message?.includes("insufficientPermissions") || error.message?.includes("403")
      ? `Partagez le dossier Drive avec : ${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL}`
      : error.message;
    res.status(500).json({ success: false, error: msg });
  }
}

import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { google } from "googleapis";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  
  if (process.env.GOOGLE_CLIENT_ID?.startsWith("AIza")) {
    console.warn("CRITICAL WARNING: GOOGLE_CLIENT_ID starts with 'AIza'. This is an API Key, NOT an OAuth 2.0 Client ID. Google Drive write operations will fail. Please use a Client ID (ending in .apps.googleusercontent.com).");
  }

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Google Drive Integration
  app.get("/api/drive/load", async (req, res) => {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REFRESH_TOKEN) {
      return res.status(400).json({ success: false, error: "Google API credentials not configured" });
    }

    try {
      const auth = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        "https://developers.google.com/oauthplayground"
      );
      auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
      const drive = google.drive({ version: "v3", auth });

      const parentFolderId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID || "1KPPA5zcvLFVPdvPFDaHkJgVfAePVLGMj";
      
      // Search for MASTER_DOSSIERS.json in the parent folder
      const response = await drive.files.list({
        q: `'${parentFolderId}' in parents and name = 'MASTER_DOSSIERS.json' and trashed = false`,
        fields: "files(id, name)",
        spaces: "drive"
      });

      if (!response.data.files || response.data.files.length === 0) {
        return res.json({ success: true, dossiers: [], message: "Aucun fichier de sauvegarde trouvé sur Drive." });
      }

      const fileId = response.data.files[0].id;
      const fileContent = await drive.files.get({
        fileId: fileId!,
        alt: "media"
      });

      res.json({
        success: true,
        dossiers: fileContent.data,
        lastSync: new Date().toISOString(),
        parentFolderId: parentFolderId
      });
    } catch (error: any) {
      console.error("Drive Load Error Full:", JSON.stringify(error, null, 2));
      
      let errorMessage = error.message;
      if (error.response?.data?.error?.message) {
        errorMessage = error.response.data.error.message;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }

      if (errorMessage?.toLowerCase().includes("google drive api has not been used") || 
          errorMessage?.toLowerCase().includes("disabled")) {
        errorMessage = "L'API Google Drive n'est pas activée. Vous DEVEZ l'activer sur ce lien : https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=646465255321";
      } else if (errorMessage?.includes("invalid_grant")) {
        errorMessage = "Le Refresh Token est invalide ou a expiré. Veuillez en générer un nouveau via le Guide Setup.";
      }

      res.status(500).json({ success: false, error: errorMessage });
    }
  });

  app.post("/api/drive/save", async (req, res) => {
    const { dossiers } = req.body;
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REFRESH_TOKEN) {
      return res.status(400).json({ success: false, error: "Google API credentials not configured" });
    }

    try {
      const auth = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        "https://developers.google.com/oauthplayground"
      );
      auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
      const drive = google.drive({ version: "v3", auth });

      const parentFolderId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID || "1KPPA5zcvLFVPdvPFDaHkJgVfAePVLGMj";
      
      // Check if MASTER_DOSSIERS.json exists
      const listResponse = await drive.files.list({
        q: `'${parentFolderId}' in parents and name = 'MASTER_DOSSIERS.json' and trashed = false`,
        fields: "files(id, name)",
        spaces: "drive"
      });

      const media = {
        mimeType: "application/json",
        body: JSON.stringify(dossiers, null, 2)
      };

      if (listResponse.data.files && listResponse.data.files.length > 0) {
        // Update existing file
        const fileId = listResponse.data.files[0].id;
        await drive.files.update({
          fileId: fileId!,
          media: media
        });
      } else {
        // Create new file
        await drive.files.create({
          requestBody: {
            name: "MASTER_DOSSIERS.json",
            parents: [parentFolderId]
          },
          media: media
        });
      }

      res.json({ success: true, message: "Sauvegarde effectuée sur Google Drive." });
    } catch (error: any) {
      console.error("Drive Save Error Full:", JSON.stringify(error, null, 2));
      
      let errorMessage = error.message;
      if (error.response?.data?.error?.message) {
        errorMessage = error.response.data.error.message;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }

      if (errorMessage?.toLowerCase().includes("google drive api has not been used") || 
          errorMessage?.toLowerCase().includes("disabled")) {
        errorMessage = "L'API Google Drive n'est pas activée. Vous DEVEZ l'activer sur ce lien : https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=646465255321";
      } else if (errorMessage?.includes("invalid_grant")) {
        errorMessage = "Le Refresh Token est invalide ou a expiré. Veuillez en générer un nouveau via le Guide Setup.";
      }

      res.status(500).json({ success: false, error: errorMessage });
    }
  });

  app.post("/api/onboarding/submit", async (req, res) => {
    const dossier = req.body;
    if (!dossier || !dossier.raisonSociale) {
      return res.status(400).json({ success: false, error: "Données invalides" });
    }

    try {
      if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REFRESH_TOKEN) {
        console.log("[ONBOARDING] Nouveau dossier reçu (sans Drive):", dossier.raisonSociale);
        return res.json({ success: true, message: "Dossier reçu. Configurez Google Drive pour le sauvegarder automatiquement." });
      }

      const auth = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        "https://developers.google.com/oauthplayground"
      );
      auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
      const drive = google.drive({ version: "v3", auth });

      const parentFolderId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID || "1KPPA5zcvLFVPdvPFDaHkJgVfAePVLGMj";

      // Load existing dossiers
      const listResponse = await drive.files.list({
        q: `'${parentFolderId}' in parents and name = 'MASTER_DOSSIERS.json' and trashed = false`,
        fields: "files(id, name)",
        spaces: "drive"
      });

      let existingDossiers: any[] = [];
      if (listResponse.data.files && listResponse.data.files.length > 0) {
        const fileId = listResponse.data.files[0].id!;
        const fileContent = await drive.files.get({ fileId, alt: "media" });
        existingDossiers = Array.isArray(fileContent.data) ? fileContent.data : [];
      }

      existingDossiers.unshift({ ...dossier, sourceOnboarding: true, receivedAt: new Date().toISOString() });

      const media = { mimeType: "application/json", body: JSON.stringify(existingDossiers, null, 2) };
      if (listResponse.data.files && listResponse.data.files.length > 0) {
        await drive.files.update({ fileId: listResponse.data.files[0].id!, media });
      } else {
        await drive.files.create({ requestBody: { name: "MASTER_DOSSIERS.json", parents: [parentFolderId] }, media });
      }

      res.json({ success: true, message: "Dossier transmis avec succès." });
    } catch (error: any) {
      console.error("Onboarding Submit Error:", error.message);
      res.status(500).json({ success: false, error: "Erreur lors de la sauvegarde du dossier." });
    }
  });

  app.post("/api/archive-to-drive", async (req, res) => {
    const { clientName, clientId, clientData } = req.body;

    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REFRESH_TOKEN) {
      // Mock implementation if credentials are missing
      const mockFolderId = `mock-folder-${clientId}`;
      const mockUrl = `https://drive.google.com/drive/folders/${mockFolderId}`;
      console.log(`[MOCK] Archiving client ${clientName} to Drive...`);
      return res.json({
        success: true,
        folderId: mockFolderId,
        folderUrl: mockUrl,
        message: "Archivage simulé (veuillez configurer les variables d'environnement Google API pour l'archivage réel)."
      });
    }

    try {
      const auth = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        "https://developers.google.com/oauthplayground"
      );

      auth.setCredentials({
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN
      });

      const drive = google.drive({ version: "v3", auth });

      // 1. Create sub-folder for client
      const parentFolderId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID || "1KPPA5zcvLFVPdvPFDaHkJgVfAePVLGMj";
      
      const folderMetadata = {
        name: `CLIENT - ${clientName}`,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentFolderId]
      };

      const folder = await drive.files.create({
        requestBody: folderMetadata,
        fields: "id, webViewLink"
      });

      const folderId = folder.data.id;
      const folderUrl = folder.data.webViewLink;

      // 2. Create a summary file inside the folder
      const fileMetadata = {
        name: "RESUME_CLIENT.json",
        parents: [folderId]
      };
      const media = {
        mimeType: "application/json",
        body: JSON.stringify(clientData, null, 2)
      };

      await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: "id"
      });

      res.json({
        success: true,
        folderId,
        folderUrl,
        message: `Dossier créé avec succès pour ${clientName}`
      });
    } catch (error: any) {
      console.error("Google Drive Archive Error Full:", JSON.stringify(error, null, 2));
      
      let errorMessage = "Erreur lors de l'archivage sur Google Drive";
      const apiMessage = error.response?.data?.error?.message || error.response?.data?.message || error.message;
      
      if (apiMessage?.toLowerCase().includes("google drive api has not been used") || 
          apiMessage?.toLowerCase().includes("disabled")) {
        errorMessage = "L'API Google Drive n'est pas activée. Vous DEVEZ l'activer sur ce lien : https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=646465255321";
      } else if (apiMessage?.includes("invalid_grant")) {
        errorMessage = "Le Refresh Token est invalide ou a expiré. Veuillez en générer un nouveau via le Guide Setup.";
      } else if (apiMessage) {
        errorMessage = apiMessage;
      }

      res.status(500).json({
        success: false,
        error: errorMessage,
        rawError: error.message
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

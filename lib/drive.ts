/**
 * Google Drive publisher for dossiers.
 *
 * Uploads markdown as a Google Doc into a designated Drive folder using the
 * Cloud Run service account's default credentials. The folder must be shared
 * with the SA email (845570509325-compute@developer.gserviceaccount.com)
 * with at least Editor permission.
 *
 * Env:
 *   GDRIVE_DOSSIERS_FOLDER_ID — target folder. Required to publish.
 */

import { google } from "googleapis";

const SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/documents",
];

interface PublishedDoc {
  docId: string;
  url: string;
  title: string;
}

export async function publishDossier(
  title: string,
  markdown: string
): Promise<PublishedDoc> {
  const folderId = process.env.GDRIVE_DOSSIERS_FOLDER_ID;
  if (!folderId) {
    throw new Error(
      "GDRIVE_DOSSIERS_FOLDER_ID not set. Share a Drive folder with the Cloud Run SA and add the folder ID as a secret."
    );
  }

  const auth = new google.auth.GoogleAuth({ scopes: SCOPES });
  const drive = google.drive({ version: "v3", auth });

  // Upload markdown with mimeType=application/vnd.google-apps.document — Drive
  // converts text/markdown into a real Google Doc with formatting preserved.
  const create = await drive.files.create({
    requestBody: {
      name: title,
      parents: [folderId],
      mimeType: "application/vnd.google-apps.document",
    },
    media: {
      mimeType: "text/markdown",
      body: markdown,
    },
    fields: "id,webViewLink",
    supportsAllDrives: true,
  });

  const docId = create.data.id;
  const url = create.data.webViewLink;
  if (!docId || !url) {
    throw new Error("Drive create returned no id/link");
  }
  return { docId, url, title };
}

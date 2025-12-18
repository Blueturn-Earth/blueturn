// drive.js
import { accessToken, requestGoogleAuth } from "./auth_google.js";

export async function deleteDriveFile(fileId) {
    await requestGoogleAuth();

  if (!accessToken) {
    throw new Error("No Google Drive access token");
  }

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  );

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Drive delete failed: ${res.status} ${txt}`);
  }
}

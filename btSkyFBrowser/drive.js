// drive.js
export async function deleteDriveFile(googleAccessToken, fileId) {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${googleAccessToken}`
      }
    }
  );

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Drive delete failed: ${res.status} ${txt}`);
  }
}

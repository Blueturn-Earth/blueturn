import {StorageProvider} from './storage_provider.js';
import {getAuthProvider} from './google_auth.js';

export default class GoogleDriveProvider extends StorageProvider {


  async uploadToDrive(blob, onProgress, onError) {
    console.log("Ensuring Google auth…");
    let googleAccessToken = await getAuthProvider().ensureAuth();
    if (!googleAccessToken) {
      const err = new Error("Failed to obtain Google access token");
      console.error(err);
      onError && onError(err);
      throw err;
    }

    let folderId;
    try {
      console.log("Ensuring SkyPhotos folder…");
      folderId = await this.ensureSkyPhotosFolder();
    } catch (e) {
      console.error(e);
      onError && onError(e);
      throw e;
    }
    const metadata = {
        name: `Sky_${Date.now()}.jpg`,
        mimeType: "image/jpeg",
        parents: [folderId]
    };

    const form = new FormData();
    form.append("metadata", new Blob(
        [JSON.stringify(metadata)],
        { type: "application/json" }
    ));
    form.append("file", blob);

    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.open(
          "POST",
          "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id"
        );

        xhr.setRequestHeader(
          "Authorization",
          `Bearer ${googleAccessToken}`
        );

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && onProgress) {
              console.log("Upload progress: ", e.loaded / e.total);
              onProgress(e.loaded / e.total);
          }
        };

        xhr.onload = () => {
          console.log("Upload to GoogleDrive completed with status: ", xhr.status);
          if (xhr.status >= 200 && xhr.status < 300) {
              const { id } = JSON.parse(xhr.responseText);
              console.log("Upload to GoogleDrive completed successfully with file ID: ", id);
              resolve(id);
          } else {
              console.error("Upload to GoogleDrive failed: ", xhr.responseText);
              reject(xhr.responseText);
          }
        };

        xhr.onerror = () => reject("Upload failed");

        console.log("Starting upload to GoogleDrive with progress tracking…: ", metadata);
        xhr.send(form);
    });
}

  async makeDriveFilePublic(fileId) {
    console.log("Making GoogleDrive file public: ", fileId);
    const googleAccessToken = await getAuthProvider().ensureAuth();
    await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${googleAccessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          role: "reader",
          type: "anyone"
        })
      }
    );
    console.log("GoogleDrive file is now public: ", fileId);
    return `https://drive.google.com/uc?id=${fileId}`;
  }

  getThumbnailUrl(fileId) {
    return `https://drive.google.com/thumbnail?id=${fileId}`; //&sz=w200-h200`;
  }

  async uploadImageToService(blob, onProgress, onError) {
    const fileId = await this.uploadToDrive(blob, onProgress, onError);
    const publicUrl = await this.makeDriveFilePublic(fileId);
    const thumbnailUrl = this.getThumbnailUrl(fileId);
    return {
      provider: "GoogleDrive",
      imageUrl: publicUrl,
      thumbnailUrl: thumbnailUrl,
      fileId: fileId
    }
  }

  async getOrCreateFolder(name, parentId = "root") {
    let googleAccessToken = await getAuthProvider().ensureAuth();
    const q = [
        `name='${name.replace("'", "\\'")}'`,
        "mimeType='application/vnd.google-apps.folder'",
        "trashed=false",
        `'${parentId}' in parents`
    ].filter(Boolean).join(" and ");

    console.log("Searching for folder with query: ", q);
    const search = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`,
        {
          method: "GET",
          headers: {
              Authorization: `Bearer ${googleAccessToken}`
          }
        }
    );

    console.log("Folder search response status: ", search.status);
    const data = await search.json();
    if (data.error || !data.files)
    {
      console.error("Error searching for folder:", data.error);
      throw new Error(data.error.message);
    }
    if (data.files.length) {
        console.log("Found existing folder: ", data.files[0]);
        return data.files[0].id;
    }

    console.log("Folder not found, creating new folder: ", name);
    const res = await fetch(
        "https://www.googleapis.com/drive/v3/files",
        {
          method: "POST",
          headers: {
              Authorization: `Bearer ${googleAccessToken}`,
              "Content-Type": "application/json"
          },
          body: JSON.stringify({
              name,
              mimeType: "application/vnd.google-apps.folder",
              parents: parentId ? [parentId] : []
          })
        }
    );

    console.log("Folder creation response status: ", res.status);
    const folder = await res.json();
    console.log("Created new folder: ", folder);
    return folder.id;
  }

  async ensureSkyPhotosFolder() {
    try {
      // Decompose UploadProvided.PATH
      const folders = this.PATH.split("/");
      let parentId = "root";
      for (const folder of folders) {
        console.log("Ensuring folder exists: ", folder);
        parentId = await this.getOrCreateFolder(folder, parentId);
      };
      const skyPhotosId = parentId;
      return skyPhotosId;
    } 
    catch (e) {
      console.error("Error ensuring SkyPhotos folder:", e);
      throw e;
    }
  }

  async deletePhoto(fileId) {
    let googleAccessToken = await getAuthProvider().ensureAuth();
    await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${googleAccessToken}`
        }
      }
    );
  }
}

let _storageProvider = null;
export function getStorageProvider() {
  if (!_storageProvider) {
    _storageProvider = new GoogleDriveProvider();
  }
  return _storageProvider;
}

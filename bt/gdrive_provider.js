import StorageProvider from './storage_provider.js';

class GoogleDriveProvider extends StorageProvider {
  constructor(clientId = '509580731574-fk6ovov57h0b2tq083jv4860qa8ofhqg.apps.googleusercontent.com') {
    super();
    this.clientId = clientId;
    this.accessToken = null;
    this.profile = null;
    this.tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: this.clientId,
      scope: 
        "openid " +
        "profile " +
        "https://www.googleapis.com/auth/drive.file " +
        "https://www.googleapis.com/auth/drive.metadata.readonly"
    });
  }

  async fetchGoogleProfile(accessToken) {
    const res = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );
    return await res.json();
  }

  setProfileButton(url, name) {
    const img = document.getElementById("profileBtn");
    img.src = url;
    img.alt = name || "Profile";
  }

  ensureAuth(reset) {
    if (reset) 
      this.accessToken = null;
    return new Promise((resolve) => {
      if (this.accessToken) {
        console.log("Already have Drive access token");
        return resolve();
      }
      console.log("Requesting Drive access token");
      this.tokenClient.callback = async (resp) => {
        if (resp.error) {
          console.error("Error obtaining Drive access token: ", resp);
          reject(resp);
        } else {
          this.accessToken = resp.access_token;
          console.log("Obtained Drive access token: ", this.accessToken);
          this.profile = await this.fetchGoogleProfile(this.accessToken);
          console.log("Obtained Google profile: ", this.profile);
          this.setProfileButton(this.profile.picture, this.profile.given_name);
          resolve(this.accessToken);
        }
      };
      this.tokenClient.requestAccessToken(/*{ prompt: "consent" }*/);
    });
  }

  getProfile()
  {
    return this.profile;
  }

  async getPersistentThumbnailUrl(fileId) {
    const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?fields=thumbnailUrl`
    );

    if (!res.ok) {
        console.error(`Could not get actual thumbnail link for file Id ${fileId}: ${res.status}`);
    }

    const thumbnailUrl = await res.json();
    return thumbnailUrl;
  }

  async getPersistentImageUrl(fileId) {
    const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?fields=webContentUrl`
    );

    if (!res.ok) {
        console.error(`Could not get actual image URL for file Id ${fileId}: ${res.status}`);
    }

    const imageUrl = await res.json();
    return imageUrl;
  }

  async uploadToDrive(blob, onProgress) {
    console.log("Ensuring Drive auth…");
    await this.ensureAuth();
    if (!this.accessToken) {
      throw new Error("Failed to obtain Drive access token");
    }

    let folderId;
    console.log("Ensuring SkyPhotos folder…");
    folderId = await this.ensureSkyPhotosFolder();

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
          `Bearer ${this.accessToken}`
        );

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && onProgress) {
              console.log("Upload progress: ", e.loaded / e.total);
              onProgress(e.loaded / e.total);
          }
        };

        xhr.onload = () => {
          console.log("Upload to Drive completed with status: ", xhr.status);
          if (xhr.status >= 200 && xhr.status < 300) {
              const { id } = JSON.parse(xhr.responseText);
              console.log("Upload to Drive completed successfully with file ID: ", id);
              resolve(id);
          } else {
              console.error("Upload to Drive failed: ", xhr.responseText);
              reject(xhr.responseText);
          }
        };

        xhr.onerror = () => reject("Upload failed");

        console.log("Starting upload to Drive with progress tracking…: ", metadata);
        xhr.send(form);
    });
  }

  async makeDriveFilePublic(fileId) {
    console.log("Making Drive file public: ", fileId);
    await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          role: "reader",
          type: "anyone"
        })
      }
    );
    console.log("Drive file is now public: ", fileId);
    return `https://drive.google.com/uc?id=${fileId}`;
  }

  async uploadImageToService(blob, onProgress) {
    const fileId = await this.uploadToDrive(blob, onProgress);

    return {
      provider: "GoogleDrive",
      fileId: fileId
    }
  }

  async getOrCreateFolder(name, parentId = "root") {
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
              Authorization: `Bearer ${this.accessToken}`
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
              Authorization: `Bearer ${this.accessToken}`,
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

  async deletePhoto(fileId) {
    await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${this.accessToken}`
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


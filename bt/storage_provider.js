export default class StorageProvider {
  PATH = "Pictures/Blueturn/SkyPhotos";

  ensureAuth() {
    throw new Error("unimplemented method");
  }

  getIdToken() {
    throw new Error("unimplemented method");
  }

  async upload(blob, onProgress, onError) {

    return await this.uploadImageToService(blob, onProgress, onError);
  }

  async uploadImageToService(blob, onProgress, onError) {
    console.error("unimplemented method");
    // That's the format we have to return
    return {
      provider: null,
      imageUrl: null,
      thumbnailUrl: null,
      fileId: null
    }
  }

  async deletePhoto(fileId) {
    console.error("unimplemented method");
  }
}


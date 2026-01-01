export default class StorageProvider {
  PATH = "Pictures/Blueturn/SkyPhotos";

  ensureAuth() {
    throw new Error("unimplemented method");
  }

  getIdToken() {
    throw new Error("unimplemented method");
  }

  async loadImageFromField(img, imageField, highRes = false, sizeLimit = 2048) {
    throw new Error("unimplemented method");
  }

  async upload(blob, onProgress) {

    return await this.uploadImageToService(blob, onProgress);
  }

  async uploadImageToService(blob, onProgress) {
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


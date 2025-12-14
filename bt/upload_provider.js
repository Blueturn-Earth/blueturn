export default class UploadProvider {
  PATH = "Pictures/Blueturn/SkyPhotos";

  constructor(serviceName) {
    this.serviceName = serviceName;
  }

  async upload(blob, onProgress, onError) {

    const url = await this.uploadImageToService(blob, onProgress, onError);
    return {
      provider: this.serviceName,
      url
    };
  }
  async uploadImageToService(blob, onProgress, onError) {
    throw new Error("unimplemented method");
  }
}


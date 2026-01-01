import { getStorageProvider } from "./gdrive_provider.js";

const popup = document.getElementById("photo-popup");
const popupImg = document.getElementById("photo-popup-img");
popup.hidden = true;  // hide by default
popup.addEventListener("click", () => {
  popup.hidden = true;
  popupImg.src = "";
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") popup.hidden = true;
});
window.addEventListener("popstate", (event) => {
  if (!popup.hidden) {
    popup.hidden = true;
    popupImg.src = "";
    history.back(); // sync history
  }
});

export async function openPopupFromThumbnail(thumbImg, data) {
  let url = data.image.thumbnailUrl;
  if (!data.image.imageUrl) {
    if(data.image.fileId) {
      data.image.imageUrl = await getStorageProvider().fetchPersistentImageUrl(data.image.fileId);
      if (data.image.imageUrl) {
        url = data.image.imageUrl;
      }
      else {
        url = data.image.thumbnailUrl;
        console.warn("Could not get image URL for file Id ", data.image.fileId);
      }
    }
  }
  if (!url && !data.image.thumbnailUrl) {
    if(data.image.fileId) {
      data.image.thumbnailUrl = await getStorageProvider().fetchPersistentThumbnailUrl(data.image.fileId);
      if (data.image.thumbnailUrl) {
        url = data.image.thumbnailUrl;
      }
      else { 
        console.warn("Could not get thumbnail URL for file Id ", data.image.fileId);
        return;
      }
    }
    else {
      console.warn("No file Id to build image or thumbnail URL");
      return;
    }
  }

  popupImg.src = thumbImg.src + "&sz=w1600"; // Load higher-res image
  popup.hidden = false;
  history.pushState({ popup: true }, "");
}

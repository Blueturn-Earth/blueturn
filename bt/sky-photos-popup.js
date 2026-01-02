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
  getStorageProvider().loadImageFromField(popupImg, data.image, true, 2048);
  popup.hidden = false;
  history.pushState({ popup: true }, "");
}

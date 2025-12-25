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

export function openPopupFromThumbnail(thumbImg) {
    popupImg.src = thumbImg.src + "&sz=w1600"; // Load higher-res image
    popup.hidden = false;
    history.pushState({ popup: true }, "");
}

  const topUI = document.getElementById("topUI");
  let hideTimeout;

  function showUI() {
    topUI.classList.remove("hidden");
    clearTimeout(hideTimeout);
    hideTimeout = setTimeout(() => {
      topUI.classList.add("hidden");
    }, 3000); // Hide after 3 seconds of inactivity
  }

  // User interactions that reset the timer and show the topUI again
  ["mousemove", "keydown", "touchstart"].forEach(event =>
    window.addEventListener(event, showUI)
  );

  showUI(); // Start the timer

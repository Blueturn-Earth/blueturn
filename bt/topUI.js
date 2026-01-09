const topUI = document.getElementById('topUI');

const activate = () => {
  topUI.classList.add('is-active');
  clearTimeout(topUI._t);
  topUI._t = setTimeout(() => {
    topUI.classList.remove('is-active');
  }, 1200); // fade back after 1.2s
};

topUI.addEventListener('pointerdown', activate);  

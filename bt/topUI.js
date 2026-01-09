import { gSetPlayState } from './app.js';
import { gControlState } from './controlparams.js';

const topUI = document.getElementById('topUI');

const activate = () => {
  topUI.classList.add('is-active');
  clearTimeout(topUI._t);
  topUI._t = setTimeout(() => {
    topUI.classList.remove('is-active');
  }, 1200); // fade back after 1.2s
};

topUI.addEventListener('pointerdown', activate);  

const skyPhotosBtn = document.getElementById('skyPhotosBtn');
const skyPhotosToggleCallbacks = new Map();
let nextCbId = 0;

export function addSkyPhotosToggleCallback(cb)
{
  skyPhotosToggleCallbacks.set(nextCbId, cb);
  applySkyPhotosState();
  return nextCbId++;
}

export function removeSkyPhotosToggleCallback(cbId)
{
  if (!skyPhotosToggleCallbacks.has(cbId))
  {
    console.error("No cbId " + cbId + " in skyPhotosToggleCallbacks map");
    return;
  }
  skyPhotosToggleCallbacks.delete(cbId);
}

export function setSkyPhotosState(isOn)
{
    skyPhotosBtn.dataset.state = isOn ? "on" : "off";
    applySkyPhotosState();
}

function applySkyPhotosState()
{
    const isOn = skyPhotosBtn.dataset.state == "on";
    if (isOn) {
        gSetPlayState(false);
        gControlState.blockSnapping = true;
    }
    else {
        gControlState.blockSnapping = false;
    }

    for (const [cbId, cb] of skyPhotosToggleCallbacks) {
      cb(isOn);
    }    
}

skyPhotosBtn.addEventListener('click', () => {
    // toggle
    const isOn = skyPhotosBtn.dataset.state === "off";
    setSkyPhotosState(isOn);
});


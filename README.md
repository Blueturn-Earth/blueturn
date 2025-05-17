# Blueturn Web App

[Live Demo](http://app.blueturn.earth)

Blueturn is a web application that produces an interactive video of the Earth using data from NASA’s EPIC API. 
Built with HTML5, Vanilla JavaScript, WebGL, and GLSL.

---

## Features

- Interactive, real-time 3D Earth visualization
- Loads daily images and metadata from NASA’s [EPIC API](https://epic.gsfc.nasa.gov/)
- Custom WebGL shaders for accurate EPIC images mapping and interpolation

---

## Project Structure

- **bt/images/** – Textures for synthetic Earth
- **bt/screen.js** – Handles high-level user events on screen
- **bt/epic.js** – Loads EPIC data from NASA API
- **bt/app.js** – Main application logic
- **bt/gl.js** – WebGL rendering code
- **bt/epic_earth.frag.glsl** – Main fragment shader (image generation)

---

## License
[Creative Commons CC BY-NC-SA 4.0
](https://creativecommons.org/licenses/by-nc-sa/4.0/)

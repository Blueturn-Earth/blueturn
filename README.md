# Blueturn Web App

[Live Web App](http://app.blueturn.earth)

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
This project is licensed under the Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) license.
You are free to:
- Share — copy and redistribute the material in any medium or format
- Adapt — remix, transform, and build upon the material

...as long as you follow these terms:

- Attribution — You must give appropriate credit to "Michael Boccara and the Blueturn Project", and include a link to the project repository or website.
- NonCommercial — You may not use the material for commercial purposes.
- ShareAlike — If you remix, transform, or build upon the material, you must distribute your contributions under the same license as the original.

Full license text: [CC BY-NC-SA 4.0
](https://creativecommons.org/licenses/by-nc-sa/4.0/)

# TODO: Add Dynamic Camera Selection in Assessment Setup

## Overview
Implement an "Add Camera" button in the assessment setup to dynamically add camera selects (up to 3). Update the camera logic to handle a variable number of cameras instead of fixed 3.

## Tasks
- [x] Modify `templates/index.html` to add "Add Camera" button and make camera selects container dynamic.
- [x] Update `static/setup.js` to handle adding/removing camera selects, update cameraSelects array, and refresh confirm screen.
- [x] Modify `static/camera.js` to start cameras based on selected number (up to 3), and dynamically create camera feeds.
- [x] Update camera feeds in `templates/index.html` to be generated dynamically or adjust logic accordingly.
- [ ] Test the functionality to ensure cameras are added/started correctly.

## Notes
- Ensure validation requires at least 1 camera, but allow up to 3.
- Update confirm screen to list selected cameras dynamically.
- Handle removal of cameras if needed (optional: add remove button per select).

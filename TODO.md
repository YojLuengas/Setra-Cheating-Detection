# TODO: Fix Camera Stop Button and Record Stacking Issues

## Overview
Address issues where the camera stop button fails on subsequent assessments and new records append to old folders instead of creating new ones. This is due to incomplete backend session cleanup and potential frontend stream state persistence.

## Steps

- [x] Step 1: Edit app.py to add a new /stop-assessment POST endpoint. This endpoint will clear session["assessment_session_id"], reset global variables (all_snapshots, notified_snapshots, last_cheating_notification_time), and return a success JSON response. Decorate with @login_required.

- [x] Step 2: Edit static/setup.js to update the stopAssessment() function. After stopping the camera and clearing localStorage, add a fetch POST to /stop-assessment to trigger backend cleanup. Include error handling for the fetch.

- [x] Step 3: Edit static/camera.js to enhance stopCamera() and startCamera() for better robustness on multiple calls. In stopCamera(), add checks to avoid errors if stream or vid is already null. In startCamera(), ensure full cleanup before new start and handle permission errors gracefully.

- [ ] Step 4: Test the implementation. Use browser to: (1) Start an assessment, confirm new folder/session created (check /records). (2) Stop assessment, verify camera stops and UI resets. (3) Start a new assessment, confirm new folder created without stacking, and stop button works. If needed, check DB for separate assessment_session_id and records.

- [ ] Step 5: If tests pass, complete the task. Update this TODO.md with completion notes.

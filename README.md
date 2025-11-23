# Deployment Instructions for Setra Cheating Detection App

This document provides instructions to deploy the Flask-based Setra Cheating Detection application on Render.com.

---

## Prerequisites

- Git repository containing the project's full source code, including:
  - Updated `app.py` which reads secrets and database config from environment variables.
  - Updated `requirements.txt` includes all dependencies, including `gunicorn`.
  - `models/best.pt` and any other necessary files are included in the repository.
- A MySQL database accessible externally with appropriate user and database created.
- Render.com account to host the web service.

---

## Environment Variables

Set the following environment variables in Render dashboard under **Environment** for your service:

```
DB_HOST=<your-mysql-host>
DB_USER=<your-mysql-username>
DB_PASSWORD=<your-mysql-password>
DB_NAME=<your-mysql-database-name>
SECRET_KEY=<your-flask-secret-key>
```

Replace placeholders with your actual database credentials and secret key.

---

## Render Service Setup

1. Create a new Web Service on Render.
2. Connect to your Git repository and select the branch to deploy.
3. Set the Environment to Python 3.
4. Set the Start Command to:

```
gunicorn -k eventlet -w 1 app:app --bind 0.0.0.0:5000
```

This runs the app using Gunicorn with the eventlet worker needed for Flask-SocketIO.

---

## Additional Notes

- Ensure your MySQL database allows remote connections from Render's IPs or use a managed database compatible with Render.
- Cache busting is enabled on static files by default in `app.py`.
- Debug mode is enabled by default; disable by modifying `app.py` if deploying to production.
- Monitor logs on Render dashboard to check for startup or runtime errors.
- The app listens on port 5000; Render handles external routing automatically.

---

## Testing After Deployment

Perform critical-path testing including:
- Accessing all major pages: login, admin, records, cheating snapshots.
- Testing real-time frame processing and SocketIO events.
- Confirming user authentication and admin functionalities.
- Ensuring database connectivity and data integrity.

For full test plans, see internal project documentation.

---

If you need further assistance or customized deployment scripts, please request.

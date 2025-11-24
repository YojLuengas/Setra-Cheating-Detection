# Railway Database Setup and Connection Instructions

This document provides instructions to connect and configure the existing Sentra Cheating Detection app with a Railway-hosted MySQL database.

## 1. Create a MySQL Database on Railway

1. Login to your Railway account at https://railway.app/
2. Create a new project and add a MySQL database plugin.
3. After the database is provisioned, note the connection details provided by Railway:
   - Host
   - Port
   - Database name
   - Username
   - Password

## 2. Set Environment Variables on Railway

1. Go to your Railway project settings.
2. Add the following environment variables with the values from your Railway MySQL database:
   ```
   DB_HOST=your_railway_host
   DB_PORT=your_railway_port
   DB_NAME=your_railway_database_name
   DB_USER=your_railway_username
   DB_PASSWORD=your_railway_password
   ```
3. These environment variables will be used by the application to connect to the Railway MySQL database.

## 3. Initialize Database Schema

You need to create the database schema inside your Railway MySQL database. There are multiple ways:

### Option A: Use Railway Database GUI

- Use the Railway database plugin's built-in GUI or connect a MySQL client with the connection info.
- Run the SQL commands from the `updated_schema.sql` file to create tables and insert initial data.

### Option B: Use MySQL CLI (locally or via Railway CLI)

- Connect to your Railway MySQL database via CLI:
  ```
  mysql -h your_railway_host -P your_railway_port -u your_railway_username -p
  ```
- When prompted, enter your password.
- Run the commands in `updated_schema.sql` with:
  ```
  source path/to/updated_schema.sql;
  ```

## 4. Deploy or Run Application

- Ensure the environment variables are available in your deployment environment (Railway automatically injects them).
- The app.py is updated to read DB connection settings from these environment variables.
- Start the application as usual.

## 5. Test Connection

- Once the app is running, verify it connects successfully to the Railway database by logging in, using features, and checking for errors.

## Additional Notes

- If running locally, you may set these environment variables in a `.env` file or your shell environment.
- Ensure proper security of your Railway credentials and secrets.
- The provided `updated_schema.sql` file contains the necessary tables, indexes, and initial user data.

---

Following these steps will connect your application to Railway's managed MySQL database, replacing local database connection.

If you need assistance with any of these steps, please consult the Railway documentation or ask for help.

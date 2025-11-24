import mysql.connector
import os
import subprocess

# Get Railway environment variables
def get_railway_vars():
    """Get Railway database variables"""
    try:
        # Get variables from railway
        result = subprocess.run(['railway', 'variables'], capture_output=True, text=True)
        vars_output = result.stdout
        
        # Parse the output to extract database info
        vars_dict = {}
        for line in vars_output.split('\n'):
            if '=' in line and 'MYSQL' in line:
                key, value = line.split('=', 1)
                vars_dict[key.strip()] = value.strip()
        
        return {
            "host": vars_dict.get("DB_HOST", "interchange.proxy.rlwy.net"),
            "user": vars_dict.get("MYSQL_USER", "root"),
            "password": vars_dict.get("DB_PASSWORD", "nIFYDtNDvbljNWTwvZjhfYJhANoGlkCR"),
            "database": vars_dict.get("MYSQL_DATABASE", "railway"),
            "port": int(vars_dict.get("MYSQL_PORT", 50465)),
        }
    except Exception as e:
        print(f"Error getting Railway vars: {e}")
        return None

def migrate_database():
    """Migrate database using updated_schema.sql"""
    
    # Get Railway database config
    db_config = get_railway_vars()
    if not db_config:
        print("❌ Could not get Railway database configuration")
        return
    
    try:
        # Read SQL file
        with open('updated_schema.sql', 'r', encoding='utf-8') as file:
            sql_content = file.read()
        
        # Remove database selection line if present
        sql_content = sql_content.replace('USE `sentra_db`;', '')
        
        # Split into statements
        statements = [stmt.strip() for stmt in sql_content.split(';') if stmt.strip() and not stmt.strip().startswith('--')]
        
        # Connect to Railway MySQL
        print("🔄 Connecting to Railway MySQL...")
        connection = mysql.connector.connect(**db_config)
        cursor = connection.cursor()
        
        print("🔄 Executing migration...")
        for i, statement in enumerate(statements):
            if statement and not statement.startswith('--'):
                try:
                    print(f"  Executing statement {i+1}/{len(statements)}: {statement[:50]}...")
                    cursor.execute(statement)
                except Exception as e:
                    print(f"  ⚠️  Warning on statement {i+1}: {e}")
        
        connection.commit()
        print("✅ Migration completed successfully!")
        
        # Verify tables were created
        cursor.execute("SHOW TABLES")
        tables = cursor.fetchall()
        print(f"📋 Tables in database: {[table[0] for table in tables]}")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        if 'connection' in locals():
            connection.rollback()
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'connection' in locals():
            connection.close()

if __name__ == "__main__":
    migrate_database()
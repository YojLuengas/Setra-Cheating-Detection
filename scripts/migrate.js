require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');

class DatabaseMigrator {
    constructor() {
        this.connection = null;
    }

    async connect() {
        try {
            this.connection = await mysql.createConnection({
                host: process.env.MYSQL_HOST,
                port: process.env.MYSQL_PORT,
                user: process.env.MYSQL_USER,
                password: process.env.MYSQL_PASSWORD,
                database: process.env.MYSQL_DATABASE,
                ssl: {
                    rejectUnauthorized: false
                },
                multipleStatements: true
            });
            console.log('✅ Connected to Railway MySQL database');
        } catch (error) {
            console.error('❌ Database connection failed:', error.message);
            throw error;
        }
    }

    async createMigrationsTable() {
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS migrations (
                id INT PRIMARY KEY AUTO_INCREMENT,
                filename VARCHAR(255) NOT NULL UNIQUE,
                executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;
        await this.connection.execute(createTableQuery);
        console.log('✅ Migrations table ready');
    }

    async getExecutedMigrations() {
        const [rows] = await this.connection.execute(
            'SELECT filename FROM migrations ORDER BY executed_at'
        );
        return rows.map(row => row.filename);
    }

    async markMigrationAsExecuted(filename) {
        await this.connection.execute(
            'INSERT INTO migrations (filename) VALUES (?)',
            [filename]
        );
    }

    async executeSQLFile(filePath) {
        try {
            const sqlContent = await fs.readFile(filePath, 'utf8');
            
            // Split by semicolon and filter out empty statements
            const statements = sqlContent
                .split(';')
                .map(stmt => stmt.trim())
                .filter(stmt => stmt.length > 0);

            for (const statement of statements) {
                if (statement.trim()) {
                    await this.connection.execute(statement);
                }
            }
            
            console.log(`✅ Executed: ${path.basename(filePath)}`);
        } catch (error) {
            console.error(`❌ Error executing ${filePath}:`, error.message);
            throw error;
        }
    }

    async runMigrations() {
        try {
            await this.connect();
            await this.createMigrationsTable();

            const migrationsDir = path.join(__dirname, '../migrations');
            
            // Check if migrations directory exists
            try {
                await fs.access(migrationsDir);
            } catch (error) {
                console.log('📁 Creating migrations directory...');
                await fs.mkdir(migrationsDir, { recursive: true });
            }

            const files = await fs.readdir(migrationsDir);
            const sqlFiles = files
                .filter(file => file.endsWith('.sql'))
                .sort();

            if (sqlFiles.length === 0) {
                console.log('📝 No SQL migration files found in migrations directory');
                console.log('💡 Create .sql files in the migrations/ directory to get started');
                return;
            }

            const executedMigrations = await this.getExecutedMigrations();
            const pendingMigrations = sqlFiles.filter(
                file => !executedMigrations.includes(file)
            );

            if (pendingMigrations.length === 0) {
                console.log('✅ All migrations are up to date');
                return;
            }

            console.log(`🚀 Running ${pendingMigrations.length} pending migration(s)...`);

            for (const file of pendingMigrations) {
                const filePath = path.join(migrationsDir, file);
                await this.executeSQLFile(filePath);
                await this.markMigrationAsExecuted(file);
            }

            console.log('🎉 All migrations completed successfully!');

        } catch (error) {
            console.error('💥 Migration failed:', error.message);
            throw error;
        } finally {
            if (this.connection) {
                await this.connection.end();
                console.log('👋 Database connection closed');
            }
        }
    }
}

// CLI Interface
async function main() {
    const migrator = new DatabaseMigrator();
    const command = process.argv[2];

    try {
        switch (command) {
            case 'up':
            case undefined:
                await migrator.runMigrations();
                break;
            default:
                console.log(`
Usage:
  node scripts/migrate.js up       - Run pending migrations
  npm run migrate                  - Same as above
                `);
        }
    } catch (error) {
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = DatabaseMigrator;
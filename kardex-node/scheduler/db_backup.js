const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

// Ensure environment variables are loaded
require('dotenv').config({ path: path.join(__dirname, '..', 'config', 'config.env') });

const RETENTION_DAYS = parseInt(process.env.DB_BACKUP_RETENTION_DAYS, 10) || 20;
const CRON_SCHEDULE = process.env.DB_BACKUP_CRON || '0 2 * * *'; // Default: every night at 02:00 AM
const backupDir = path.join(__dirname, '..', 'backups');

/**
 * Locate pg_dump executable on Windows or system PATH
 */
function getPgDumpBinary() {
    if (process.env.PG_DUMP_PATH && fs.existsSync(process.env.PG_DUMP_PATH)) {
        return process.env.PG_DUMP_PATH;
    }
    const candidates = [
        'C:\\Program Files\\PostgreSQL\\17\\bin\\pg_dump.exe',
        'C:\\Program Files\\PostgreSQL\\16\\bin\\pg_dump.exe',
        'C:\\Program Files\\PostgreSQL\\15\\bin\\pg_dump.exe',
        'C:\\Program Files\\PostgreSQL\\14\\bin\\pg_dump.exe',
    ];
    for (const p of candidates) {
        if (fs.existsSync(p)) {
            return p;
        }
    }
    return 'pg_dump';
}

/**
 * Clean up backup files older than RETENTION_DAYS
 */
function cleanupOldBackups() {
    try {
        if (!fs.existsSync(backupDir)) return;
        const now = Date.now();
        const maxAgeMs = RETENTION_DAYS * 24 * 60 * 60 * 1000;
        const files = fs.readdirSync(backupDir);

        for (const file of files) {
            if (file.endsWith('.dump') || file.endsWith('.sql')) {
                const filePath = path.join(backupDir, file);
                try {
                    const stats = fs.statSync(filePath);
                    if (now - stats.mtimeMs > maxAgeMs) {
                        fs.unlinkSync(filePath);
                        console.log(`[DB BACKUP] Cleaned up expired backup (> ${RETENTION_DAYS} days): ${file}`);
                    }
                } catch (e) {
                    // Ignore transient file stat errors
                }
            }
        }
    } catch (err) {
        console.error('[DB BACKUP] Cleanup error:', err.message);
    }
}

/**
 * Execute a single database backup
 */
function executeBackup() {
    return new Promise((resolve, reject) => {
        try {
            const dbName = process.env.DB_DATABASE || 'JBL';
            const dbUser = process.env.DB_USERNAME || 'postgres';
            const dbHost = process.env.DB_HOST || 'localhost';
            const dbPort = process.env.DB_PORT || '5432';
            const dbPassword = process.env.DB_PASSWORD || '';

            if (!fs.existsSync(backupDir)) {
                fs.mkdirSync(backupDir, { recursive: true });
            }

            const now = new Date();
            const pad = (n) => String(n).padStart(2, '0');
            const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
            const backupFile = path.join(backupDir, `${dbName}_${timestamp}.dump`);

            const pgDump = getPgDumpBinary();
            const args = [
                '-h', dbHost,
                '-p', String(dbPort),
                '-U', dbUser,
                '-F', 'c',
                '-b',
                '-v',
                '-f', backupFile,
                dbName
            ];

            console.log(`[DB BACKUP] Starting automated backup of database "${dbName}"...`);

            const childEnv = { ...process.env, PGPASSWORD: dbPassword };

            execFile(pgDump, args, { env: childEnv, maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
                if (error) {
                    console.error('[DB BACKUP] Backup failed:', error.message);
                    return reject(error);
                }

                try {
                    const stats = fs.statSync(backupFile);
                    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
                    console.log(`[DB BACKUP] Backup SUCCESS: ${path.basename(backupFile)} (${sizeMB} MB)`);
                } catch (_) {
                    console.log(`[DB BACKUP] Backup SUCCESS: ${path.basename(backupFile)}`);
                }

                // Run 20-day cleanup after successful backup
                cleanupOldBackups();
                resolve(backupFile);
            });
        } catch (err) {
            console.error('[DB BACKUP] Error initiating backup:', err.message);
            reject(err);
        }
    });
}

// Register the daily background cron schedule
if (process.env.ENABLE_DB_BACKUP !== 'false') {
    if (cron.validate(CRON_SCHEDULE)) {
        cron.schedule(CRON_SCHEDULE, () => {
            executeBackup().catch(() => {});
        });
        console.log(`[DB BACKUP] Scheduled daily backup job active (Schedule: "${CRON_SCHEDULE}", Retention: ${RETENTION_DAYS} days)`);
    } else {
        console.error(`[DB BACKUP] Invalid CRON_SCHEDULE expression: "${CRON_SCHEDULE}". Daily backup was NOT scheduled.`);
    }
}

module.exports = {
    executeBackup,
    cleanupOldBackups
};


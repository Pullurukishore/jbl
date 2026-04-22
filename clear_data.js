const fs = require('fs');
const path = require('path');

// Manually load env variables from config.env since dotenv is not in root node_modules
const envPath = path.join(__dirname, 'kardex-node', 'config', 'config.env');
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
            process.env[key.trim()] = valueParts.join('=').trim().replace(/^['"]|['"]$/g, '');
        }
    });
}

const db = require('./kardex-node/models');

async function clearAllData() {
    try {
        console.log('--- Database Cleanup Started ---');

        // Note: We destroy in order to handle potential foreign key constraints
        // Using truncate: true and restartIdentity: true if supported, 
        // but destroy {where: {}} is safer for cross-DB compatibility.

        console.log('Clearing Logs...');
        await db.log.destroy({ where: {}, truncate: false });

        console.log('Clearing Picks...');
        await db.pick.destroy({ where: {}, truncate: false });

        console.log('Clearing Puts...');
        await db.put.destroy({ where: {}, truncate: false });

        console.log('Clearing Files history...');
        await db.files.destroy({ where: {}, truncate: false });

        console.log('--- Cleanup Finished ---');
        console.log('Note: Users were not deleted. IDs will restart depending on your database engine.');
        process.exit(0);
    } catch (error) {
        console.error('FAILED TO CLEAR DATA:', error);
        process.exit(1);
    }
}

clearAllData();

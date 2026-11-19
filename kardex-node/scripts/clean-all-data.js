#!/usr/bin/env node
'use strict';

/**
 * ============================================================================
 * Kardex Remstar System - Clean / Reset Data Script
 * ============================================================================
 * Usage:
 *   node scripts/clean-all-data.js                    (Interactive inventory reset)
 *   node scripts/clean-all-data.js --all             (Full wipe of DB & files)
 *   node scripts/clean-all-data.js --all --yes       (Non-interactive full wipe)
 *   node scripts/clean-all-data.js --all --seed-admin (Full wipe & create admin)
 *   node scripts/clean-all-data.js --files-only      (Clean text-files & uploads)
 *   node scripts/clean-all-data.js --db-only         (Clean DB tables only)
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const bcrypt = require('bcryptjs');

// Load environment variables
const envPath = path.join(__dirname, '..', 'config', 'config.env');
require('dotenv').config({ path: envPath });

const db = require('../models');

// Parse command line arguments
const args = process.argv.slice(2);
const isHelp = args.includes('--help') || args.includes('-h');
const isAll = args.includes('--all') || args.includes('--hard');
const isForce = args.includes('--yes') || args.includes('-y') || args.includes('--force');
const isDbOnly = args.includes('--db-only');
const isFilesOnly = args.includes('--files-only');
const clearBins = args.includes('--bins') || args.includes('--clear-bins') || isAll;
const includeUsers = args.includes('--include-users') || (isAll && !args.includes('--keep-users'));
const seedAdmin = args.includes('--seed-admin') || (isAll && includeUsers);

if (isHelp) {
    console.log(`
============================================================================
              KARDEX REMSTAR - DATABASE & FILE CLEAN TOOL
============================================================================
Usage:
  node scripts/clean-all-data.js [options]
  .\\clean-data.ps1 [options]
  clean-data.bat [options]

Modes:
  (default)            Reset inventory & transactions (Puts, Picks, Logs, Files)
                       and reset Bins/Compartments to EMPTY. Keeps Bins and Users.
  --bins               Wipe all Bins, Compartments, and Bin Types in addition to
                       inventory, while preserving Users.
  --all, --hard        Full database wipe (Truncates ALL tables including Bins & Users).
                       Re-seeds default administrator (admin / admin123).

Options:
  --bins               Delete all bin definitions, compartments, and bin types.
  --include-users      Delete user accounts as well.
  --keep-users         Keep users when using --all.
  --seed-admin         Re-create default admin account (admin / admin123).
  --db-only            Clean database tables only (leave files on disk).
  --files-only         Clean disk files only (leave database untouched).
  -y, --yes, --force   Skip confirmation prompt (non-interactive mode).
  -h, --help           Show this help information.
============================================================================
`);
    process.exit(0);
}

// Directories to clean
const textFileBase = path.join(__dirname, '..', '..', 'text-file');
const uploadsBase = path.join(__dirname, '..', 'uploads');

const targetDirs = [
    path.join(textFileBase, 'put', 'Success'),
    path.join(textFileBase, 'put', 'Error'),
    path.join(textFileBase, 'put', 'IN'),
    path.join(textFileBase, 'pick', 'Success'),
    path.join(textFileBase, 'pick', 'Error'),
    path.join(textFileBase, 'pick', 'IN'),
    uploadsBase
];

// Helper: Ask confirmation
function askConfirmation(question) {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.trim().toLowerCase());
        });
    });
}

// Helper: Clean directory files while keeping folder structure
function cleanDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) {
        return 0;
    }
    let removedCount = 0;
    try {
        const files = fs.readdirSync(dirPath);
        for (const file of files) {
            const fullPath = path.join(dirPath, file);
            const stat = fs.statSync(fullPath);
            if (stat.isFile()) {
                fs.unlinkSync(fullPath);
                removedCount++;
            } else if (stat.isDirectory()) {
                removedCount += cleanDirectory(fullPath);
                // Optionally remove subdirectories inside uploads
                if (dirPath.includes('uploads')) {
                    try { fs.rmdirSync(fullPath); } catch (_) {}
                }
            }
        }
    } catch (err) {
        console.warn(`[WARN] Failed to clean ${dirPath}: ${err.message}`);
    }
    return removedCount;
}

// Helper: Reset database
async function cleanDatabase() {
    const dialect = db.sequelize.getDialect();
    console.log(`\nConnecting to database (${dialect})...`);

    await db.sequelize.authenticate();
    console.log(` Database connection established.\n`);

    const stats = {};

    if (isAll) {
        console.log('⚡ Mode: FULL DATABASE PURGE (all tables)');

        if (dialect === 'postgres') {
            const tablesToTruncate = [
                '"log"',
                '"put"',
                '"pick"',
                '"files"',
                '"compartment"',
                '"handling_unit"',
                '"bin_type"'
            ];
            if (includeUsers) {
                tablesToTruncate.push('"user"');
            }
            const query = `TRUNCATE TABLE ${tablesToTruncate.join(', ')} RESTART IDENTITY CASCADE;`;
            await db.sequelize.query(query);
            console.log(`  Truncated all tables with CASCADE.`);
        } else if (dialect === 'mysql') {
            await db.sequelize.query('SET FOREIGN_KEY_CHECKS = 0;');
            const tables = ['log', 'put', 'pick', 'files', 'compartment', 'handling_unit', 'bin_type'];
            if (includeUsers) tables.push('user');
            for (const tbl of tables) {
                await db.sequelize.query(`TRUNCATE TABLE \`${tbl}\`;`);
            }
            await db.sequelize.query('SET FOREIGN_KEY_CHECKS = 1;');
            console.log(`  Truncated all tables.`);
        } else {
            // Generic Sequelize deletion
            await db.log.destroy({ where: {}, truncate: true, cascade: true });
            await db.put.destroy({ where: {}, truncate: true, cascade: true });
            await db.pick.destroy({ where: {}, truncate: true, cascade: true });
            await db.files.destroy({ where: {}, truncate: true, cascade: true });
            await db.compartment.destroy({ where: {}, truncate: true, cascade: true });
            await db.handling_unit.destroy({ where: {}, truncate: true, cascade: true });
            await db.bin_type.destroy({ where: {}, truncate: true, cascade: true });
            if (includeUsers) {
                await db.user.destroy({ where: {}, truncate: true, cascade: true });
            }
        }

        // Re-seed essential bin types so new bins can be registered
        console.log('\n  Re-seeding standard bin types (15, 20, 30 compartments)...');
        await db.bin_type.bulkCreate([
            { name: 'Type-A (15 Compartments)', compartment_count: 15, bin_name: 'CON_BINA', description: '15-compartment bin' },
            { name: 'Type-B (20 Compartments)', compartment_count: 20, bin_name: 'CON_BINB', description: '20-compartment bin' },
            { name: 'Type-C (30 Compartments)', compartment_count: 30, bin_name: 'CON_BINC', description: '30-compartment bin' },
            { name: 'Type-D (30 Compartments - Vertical)', compartment_count: 30, bin_name: 'CON_BIND', description: 'Side bin vertical (30 Compartments)' }
        ]);
        console.log('  Standard bin types ready.');

        // Re-seed default admin user if requested
        if (includeUsers && seedAdmin) {
            console.log('\n  Re-creating default Administrator user...');
            const hashedPassword = bcrypt.hashSync('admin123', 10);
            await db.user.create({
                first_name: 'Admin',
                last_name: 'System',
                user_id: 'admin',
                email: 'admin@kardex.local',
                password: hashedPassword,
                role: 'ADMIN',
                access_type: 'BOTH',
                created_by: 'CLEAN_SCRIPT'
            });
            console.log('  Admin created: User ID: "admin" | Password: "admin123"');
        }
    } else {
        console.log(' Mode: RESET INVENTORY & TRANSACTIONS (Preserving Bins & Users)');

        if (dialect === 'postgres') {
            try {
                await db.sequelize.query('TRUNCATE TABLE "log", "put", "pick", "files" RESTART IDENTITY CASCADE;');
                console.log('  Cleared logs, puts, picks, files and restarted ID sequences.');
            } catch (err) {
                console.warn('  TRUNCATE failed, falling back to delete:', err.message);
                stats.logs = await db.log.destroy({ where: {} });
                stats.puts = await db.put.destroy({ where: {} });
                stats.picks = await db.pick.destroy({ where: {} });
                stats.files = await db.files.destroy({ where: {} });
                console.log('  Cleared logs, puts, picks, and file records.');
            }
        } else {
            // 1. Delete logs
            stats.logs = await db.log.destroy({ where: {} });
            console.log(`  Cleared ${stats.logs} activity/transaction logs.`);

            // 2. Delete puts (serialized material inventory)
            stats.puts = await db.put.destroy({ where: {} });
            console.log(`  Cleared ${stats.puts} PUT inventory items.`);

            // 3. Delete picks
            stats.picks = await db.pick.destroy({ where: {} });
            console.log(`  Cleared ${stats.picks} PICK order records.`);

            // 4. Delete file records
            stats.files = await db.files.destroy({ where: {} });
            console.log(`  Cleared ${stats.files} file records.`);
        }

        if (clearBins) {
            console.log('  Deleting all Compartments, Handling Units, and Bin Types...');
            if (dialect === 'postgres') {
                await db.sequelize.query('TRUNCATE TABLE "compartment", "handling_unit", "bin_type" RESTART IDENTITY CASCADE;');
            } else {
                await db.compartment.destroy({ where: {} });
                await db.handling_unit.destroy({ where: {} });
                await db.bin_type.destroy({ where: {} });
            }
            console.log('  Deleted all compartments, handling units, and bin types.');

            // Re-seed essential bin types so new bins can be registered
            console.log('  Re-seeding standard bin types (15, 20, 30 compartments)...');
            await db.bin_type.bulkCreate([
                { name: 'Type-A (15 Compartments)', compartment_count: 15, bin_name: 'CON_BINA', description: '15-compartment bin' },
                { name: 'Type-B (20 Compartments)', compartment_count: 20, bin_name: 'CON_BINB', description: '20-compartment bin' },
                { name: 'Type-C (30 Compartments)', compartment_count: 30, bin_name: 'CON_BINC', description: '30-compartment bin' },
                { name: 'Type-D (30 Compartments - Vertical)', compartment_count: 30, bin_name: 'CON_BIND', description: 'Side bin vertical (30 Compartments)' }
            ]);
            console.log('  Standard bin types ready.');
        } else {
            // 5. Reset all Compartments to EMPTY
            const [compUpdated] = await db.compartment.update({
                status: 'EMPTY',
                serial_number: null,
                material_name: null,
                allocated_at: null,
                allocated_by: null
            }, { where: {} });
            console.log(`  Reset ${compUpdated} bin compartments to EMPTY.`);

            // 6. Reset all Handling Units to EMPTY status
            const [huUpdated] = await db.handling_unit.update({
                hu_status: 'EMPTY',
                last_transaction: null,
                transaction_status: null,
                put_order_seq: 0
            }, { where: {} });
            console.log(`  Reset ${huUpdated} handling units to EMPTY.`);
        }

        if (includeUsers) {
            stats.users = await db.user.destroy({ where: {} });
            console.log(`  Cleared ${stats.users} user accounts.`);
            if (seedAdmin) {
                console.log('  Creating default admin user...');
                const hashedPassword = bcrypt.hashSync('admin123', 10);
                await db.user.create({
                    first_name: 'Admin',
                    last_name: 'System',
                    user_id: 'admin',
                    email: 'admin@kardex.local',
                    password: hashedPassword,
                    role: 'ADMIN',
                    access_type: 'BOTH',
                    created_by: 'CLEAN_SCRIPT'
                });
                console.log('  Admin created: User ID: "admin" | Password: "admin123"');
            }
        }
    }
}

// Main execution
async function main() {
    console.log('====================================================');
    console.log('      KARDEX REMSTAR - DATA PURGE & RESET TOOL      ');
    console.log('====================================================');
    console.log(`Action: ${isAll ? 'FULL PURGE (All tables + files)' : 'RESET INVENTORY (Puts/Picks/Logs + Reset Bins + files)'}`);
    console.log(`Target database: ${process.env.DB_DATABASE || 'kardex'}`);
    console.log(`Target files: text-file/put, text-file/pick, uploads`);
    console.log('====================================================');

    if (!isForce) {
        const prompt = isAll
            ? '\n⚠️  WARNING: This will permanently wipe ALL database tables and files.\nAre you absolutely sure? Type "yes" to proceed: '
            : '\n⚠️  This will clear all inventory, puts, picks, logs, and generated files.\nBins and users will be preserved.\nType "yes" to proceed: ';

        const answer = await askConfirmation(prompt);
        if (answer !== 'yes' && answer !== 'y') {
            console.log('\n❌ Operation cancelled by user. No data was modified.');
            process.exit(0);
        }
    }

    // 1. Clean Database
    if (!isFilesOnly) {
        try {
            await cleanDatabase();
        } catch (err) {
            console.error('\n❌ Database cleaning failed:', err.message);
            process.exit(1);
        }
    }

    // 2. Clean Disk Files
    if (!isDbOnly) {
        console.log('\n Cleaning generated files on disk...');
        let totalFilesRemoved = 0;
        for (const dir of targetDirs) {
            const count = cleanDirectory(dir);
            console.log(`  Cleaned ${dir} (${count} files removed)`);
            totalFilesRemoved += count;
        }

        // Clean loose test txt files in text-file/
        try {
            const looseFiles = fs.readdirSync(textFileBase);
            for (const f of looseFiles) {
                const full = path.join(textFileBase, f);
                if (fs.statSync(full).isFile() && f.endsWith('.txt')) {
                    fs.unlinkSync(full);
                    totalFilesRemoved++;
                }
            }
        } catch (_) {}

        console.log(`\n Total disk files removed: ${totalFilesRemoved}`);
    }

    console.log('\n====================================================');
    console.log('       DATA PURGE & RESET COMPLETED SUCCESSFULLY!   ');
    console.log('====================================================\n');
    process.exit(0);
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});


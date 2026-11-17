const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../config/config.env') });

const db = require('../models');

async function main() {
    try {
        console.log('Connecting to database...');
        await db.sequelize.authenticate();
        console.log('Database connected successfully.');

        // 1. Fix missing columns on "put" table
        console.log('\nChecking "put" table columns in database...');
        const queryInterface = db.sequelize.getQueryInterface();
        const putTable = await queryInterface.describeTable('put').catch(() => null);

        if (putTable) {
            if (!putTable.compartment_id) {
                console.log('Adding missing column "compartment_id" to "put" table...');
                if (db.sequelize.getDialect() === 'postgres') {
                    await db.sequelize.query('ALTER TABLE "put" ADD COLUMN IF NOT EXISTS "compartment_id" INTEGER;');
                } else {
                    await queryInterface.addColumn('put', 'compartment_id', {
                        type: db.Sequelize.INTEGER,
                        allowNull: true
                    });
                }
                console.log('Added "compartment_id" to "put".');
            } else {
                console.log('Column "compartment_id" already exists in "put".');
            }

            if (!putTable.handling_unit_id) {
                console.log('Adding missing column "handling_unit_id" to "put" table...');
                if (db.sequelize.getDialect() === 'postgres') {
                    await db.sequelize.query('ALTER TABLE "put" ADD COLUMN IF NOT EXISTS "handling_unit_id" INTEGER;');
                } else {
                    await queryInterface.addColumn('put', 'handling_unit_id', {
                        type: db.Sequelize.INTEGER,
                        allowNull: true
                    });
                }
                console.log('Added "handling_unit_id" to "put".');
            } else {
                console.log('Column "handling_unit_id" already exists in "put".');
            }
        }

        // 2. Ensure standard bin types exist
        console.log('\nEnsuring standard bin types exist...');
        let binType30 = await db.bin_type.findOne({ where: { compartment_count: 30 } });
        if (!binType30) {
            console.log('Creating standard bin types (15, 20, 30 compartments)...');
            await db.bin_type.bulkCreate([
                { name: 'Type-A (15 Compartments)', compartment_count: 15, bin_name: 'CON_BINA', description: '15-compartment bin' },
                { name: 'Type-B (20 Compartments)', compartment_count: 20, bin_name: 'CON_BINB', description: '20-compartment bin' },
                { name: 'Type-C (30 Compartments)', compartment_count: 30, bin_name: 'CON_BINC', description: '30-compartment bin' }
            ], { ignoreDuplicates: true });
            binType30 = await db.bin_type.findOne({ where: { compartment_count: 30 } });
        }
        console.log(`Using Bin Type: ${binType30.name} (ID: ${binType30.id})`);

        // 3. Handling Unit ID from CLI argument or default
        const huId = process.argv[2] || 'HU-30-001';
        console.log(`\nCreating/updating Handling Unit "${huId}" with 30 compartments...`);

        let hu = await db.handling_unit.findOne({ where: { hu_id: huId } });
        if (!hu) {
            hu = await db.handling_unit.create({
                hu_id: huId,
                bin_type_id: binType30.id,
                hu_status: 'EMPTY',
                storage_status: 'DRAFT',
                registered_by: 'SCRIPT'
            });
            console.log(`Created Handling Unit "${huId}" (ID: ${hu.id}).`);
        } else {
            console.log(`Found existing Handling Unit "${huId}" (ID: ${hu.id}).`);
            await hu.update({ bin_type_id: binType30.id });
        }

        // 4. Create 30 compartments
        const existingComps = await db.compartment.findAll({ where: { handling_unit_id: hu.id } });
        if (existingComps.length === 0) {
            const rows = [];
            for (let i = 1; i <= 30; i++) {
                rows.push({
                    handling_unit_id: hu.id,
                    compartment_number: i,
                    status: 'EMPTY'
                });
            }
            await db.compartment.bulkCreate(rows);
            console.log(`Created 30 compartments (1-30) for Handling Unit "${huId}".`);
        } else if (existingComps.length < 30) {
            const existingNums = new Set(existingComps.map(c => c.compartment_number));
            const newRows = [];
            for (let i = 1; i <= 30; i++) {
                if (!existingNums.has(i)) {
                    newRows.push({
                        handling_unit_id: hu.id,
                        compartment_number: i,
                        status: 'EMPTY'
                    });
                }
            }
            if (newRows.length > 0) {
                await db.compartment.bulkCreate(newRows);
                console.log(`Added missing ${newRows.length} compartments to reach 30 compartments.`);
            }
        } else {
            console.log(`Handling Unit "${huId}" already has ${existingComps.length} compartments.`);
        }

        console.log(`\n============================================================`);
        console.log(` SUCCESS: Handling Unit "${huId}" is ready with 30 compartments!`);
        console.log(` URL: http://localhost:3000/app/bins/${encodeURIComponent(huId)}`);
        console.log(`============================================================\n`);
        process.exit(0);
    } catch (err) {
        console.error('Error during execution:', err);
        process.exit(1);
    }
}

main();


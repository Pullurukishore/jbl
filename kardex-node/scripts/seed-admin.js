'use strict';

const path = require('path');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../config/config.env') });

const db = require('../models');

async function seedAdmin() {
    try {
        console.log('Connecting to database...');
        await db.sequelize.authenticate();
        console.log('Database connected successfully.');

        const userId = 'admin';
        const passwordPlain = 'admin123';
        const hashedPassword = bcrypt.hashSync(passwordPlain, 10);

        const existingAdmin = await db.user.findOne({ where: { user_id: userId } });

        if (existingAdmin) {
            console.log(`User "${userId}" already exists. Updating password and permissions...`);
            await existingAdmin.update({
                password: hashedPassword,
                role: 'ADMIN',
                access_type: 'BOTH',
                updated_by: 'SEED_SCRIPT'
            });
            console.log(`Admin user "${userId}" updated successfully.`);
        } else {
            console.log(`Creating new Admin user "${userId}"...`);
            await db.user.create({
                first_name: 'Admin',
                last_name: 'System',
                user_id: userId,
                email: 'admin@kardex.local',
                password: hashedPassword,
                role: 'ADMIN',
                access_type: 'BOTH',
                created_by: 'SEED_SCRIPT'
            });
            console.log(`Admin user "${userId}" created successfully.`);
        }

        console.log('\n=============================================');
        console.log('  Admin Credentials:');
        console.log(`  User ID  : ${userId}`);
        console.log(`  Password : ${passwordPlain}`);
        console.log('  Role     : ADMIN');
        console.log('=============================================\n');
        process.exit(0);
    } catch (err) {
        console.error('Failed to create/reset admin user:', err);
        process.exit(1);
    }
}

seedAdmin();

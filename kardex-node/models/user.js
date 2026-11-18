'use strict';

module.exports = (sequelize, DataTypes) => {
    const model = sequelize.define('user', {
        first_name: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        last_name: {
            type: DataTypes.STRING,
        },
        role: {
            type: DataTypes.ENUM(['ADMIN', 'USER']),
            allowNull: false,
            defaultValue: 'USER'
        },
        access_type: {
            type: DataTypes.ENUM(['PUT_ONLY', 'PICK_ONLY', 'BOTH']),
            allowNull: false,
            defaultValue: 'BOTH'
        },
        user_id: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
        },
        email: {
            type: DataTypes.STRING,
            unique: true,
        },
        password: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        created_by: {
            type: DataTypes.STRING,
            defaultValue: 'SYSTEM'
        },
        updated_by: {
            type: DataTypes.STRING,
            defaultValue: 'SYSTEM'
        },
        created_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
        }
    },
        {
            engine: 'InnoDB',
            charset: 'utf8',
            underscored: false,
            paranoid: false,
            timestamps: false,
            freezeTableName: true,
        });

    model.afterSync(async (options) => {
        try {
            const dialect = sequelize.getDialect();
            if (dialect === 'postgres') {
                await sequelize.query(`
                    DO $$
                    BEGIN
                        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_user_access_type') THEN
                            CREATE TYPE "enum_user_access_type" AS ENUM ('PUT_ONLY', 'PICK_ONLY', 'BOTH');
                        END IF;
                    END$$;
                `);
                await sequelize.query(`
                    ALTER TABLE "user"
                    ADD COLUMN IF NOT EXISTS "access_type" "enum_user_access_type" NOT NULL DEFAULT 'BOTH';
                `);
                await sequelize.query(`
                    ALTER TABLE "user"
                    ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT TRUE;
                `);
            } else {
                const qi = sequelize.getQueryInterface();
                const tableDesc = await qi.describeTable('user');
                if (!tableDesc.access_type) {
                    await qi.addColumn('user', 'access_type', {
                        type: DataTypes.ENUM(['PUT_ONLY', 'PICK_ONLY', 'BOTH']),
                        allowNull: false,
                        defaultValue: 'BOTH',
                    });
                }
                if (!tableDesc.is_active) {
                    await qi.addColumn('user', 'is_active', {
                        type: DataTypes.BOOLEAN,
                        allowNull: false,
                        defaultValue: true,
                    });
                }
            }
        } catch (err) {
            console.error('user access_type migration check error:', err.message);
        }

        const bcrypt = require('bcryptjs');
        const existingUser = await model.findOne();
        if (!existingUser) {
            await model.create({
                first_name: 'Admin',
                last_name: 'User',
                role: 'ADMIN',
                access_type: 'BOTH',
                user_id: process.env.SuperAdminUserId,
                password: await bcrypt.hash(process.env.SuperAdminUserPassword, 10),
            });
        } else {
            // Hash any previously created plain-text passwords so bcrypt login succeeds
            const allUsers = await model.findAll({ attributes: ['id', 'password'] });
            for (const u of allUsers) {
                if (u.password && !u.password.startsWith('$2')) {
                    await u.update({ password: await bcrypt.hash(u.password, 10) });
                }
            }
        }
    });

    return model;
}

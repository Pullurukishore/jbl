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
        const existingUser = await model.findOne();
        if (!existingUser) {
            const bcrypt = require('bcrypt');
            await model.create({
                first_name: 'Admin',
                last_name: 'User',
                role: 'ADMIN',
                user_id: process.env.SuperAdminUserId,
                password: await bcrypt.hash(process.env.SuperAdminUserPassword, 10),
            });
        };
    });

    return model;
}

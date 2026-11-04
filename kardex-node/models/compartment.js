'use strict';

module.exports = (sequelize, DataTypes) => {
    const model = sequelize.define('compartment', {
        compartment_number: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        status: {
            type: DataTypes.ENUM(['OCCUPIED', 'EMPTY']),
            allowNull: false,
            defaultValue: 'EMPTY'
        },
        serial_number: {
            type: DataTypes.STRING,
            allowNull: true
        },
        material_name: {
            type: DataTypes.STRING,
            allowNull: true
        },
        allocated_at: {
            type: DataTypes.DATE,
            allowNull: true
        },
        allocated_by: {
            type: DataTypes.STRING,
            allowNull: true
        }
    }, {
        engine: 'InnoDB',
        charset: 'utf8',
        underscored: false,
        paranoid: false,
        timestamps: true,
        freezeTableName: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    });

    return model;
};

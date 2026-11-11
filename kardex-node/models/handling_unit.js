'use strict';

module.exports = (sequelize, DataTypes) => {
    const model = sequelize.define('handling_unit', {
        hu_id: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        hu_status: {
            type: DataTypes.ENUM(['EMPTY', 'PARTIALLY_FILLED', 'FULL']),
            allowNull: false,
            defaultValue: 'EMPTY'
        },
        storage_status: {
            type: DataTypes.ENUM(['DRAFT', 'IN_KARDEX', 'OUTSIDE_KARDEX']),
            allowNull: false,
            defaultValue: 'DRAFT'
        },
        last_transaction: {
            type: DataTypes.ENUM(['PUT', 'MATERIAL_PICK', 'HU_PICK']),
            allowNull: true
        },
        transaction_status: {
            type: DataTypes.ENUM(['PENDING', 'SUCCESSFUL', 'FAILED']),
            allowNull: true
        },
        registered_by: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: 'SYSTEM'
        },
        put_order_seq: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
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

'use strict';

const uuid4 = require("uuid4");


module.exports = (sequelize, DataTypes) => {
    const model = sequelize.define('put', {
        serial_number: {
            type: DataTypes.STRING,
            allowNull: false
        },
        birth_date: {
            type: DataTypes.DATE,
        },
        pv_status: {
            type: DataTypes.ENUM(['PASS', 'FAIL'])
        },
        process_status: {
            type: DataTypes.ENUM(['KANBAN_IN', 'KANBAN_OUT', 'KANBAN_RTN'])
        },
        model_number: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        text_file_downloaded: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        scanned_by: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: 'SYSTEM'
        },
        pick_status: {
            type: DataTypes.ENUM(['AVAILABLE', 'PICKED', 'HOLD']),
            allowNull: false
        },
    },
        {
            engine: 'InnoDB',
            charset: 'utf8',
            underscored: false,
            paranoid: false,
            timestamps: true,
            createdAt: 'scanned_at',
            updatedAt: 'scanned_at',
            freezeTableName: true,
        })

    return model;
}
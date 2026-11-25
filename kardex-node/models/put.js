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
            type: DataTypes.ENUM(['KANBAN-IN', 'KANBAN-OUT', 'KANBAN-RTN', 'KANBAN_IN', 'KANBAN_OUT', 'KANBAN_RTN'])
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
        handling_unit_id: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        compartment_id: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
    },
        {
            engine: 'InnoDB',
            charset: 'utf8',
            underscored: false,
            paranoid: false,
            timestamps: true,
            createdAt: 'scanned_at',
            updatedAt: false,
            freezeTableName: true,
            indexes: [
                { name: 'idx_put_serial_number', fields: ['serial_number'] },
                { name: 'idx_put_pick_status_scanned_at', fields: ['pick_status', 'scanned_at'] },
                { name: 'idx_put_model_number', fields: ['model_number'] },
                { name: 'idx_put_handling_unit_id', fields: ['handling_unit_id'] },
                { name: 'idx_put_compartment_id', fields: ['compartment_id'] },
                { name: 'idx_put_pick_id', fields: ['pick_id'] }
            ]
        })

    return model;
}

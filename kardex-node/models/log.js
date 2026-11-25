'use strict';


module.exports = (sequelize, DataTypes) => {
    const model = sequelize.define('log', {
        entity_number: {
            type: DataTypes.STRING,
            allowNull: false
        },
        activity: {
            type: DataTypes.STRING,
            allowNull: false
        },
        title: {
            type: DataTypes.STRING
        },
        status: {
            type: DataTypes.ENUM(['SUCCESS', 'FAILED']),
            allowNull: false
        },
        message: {
            type: DataTypes.TEXT
        },
        log_date_time: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
        logged_by: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: 'SYSTEM'
        },
        process_id: {
            type: DataTypes.STRING,
            allowNull: false
        },
        log_type: {
            type: DataTypes.ENUM(['PUT_PROCESS', 'PICK_PROCESS']),
            allowNull: false
        }
    },
        {
            engine: 'InnoDB',
            charset: 'utf8',
            underscored: false,
            paranoid: false,
            timestamps: false,
            freezeTableName: true,
            indexes: [
                { name: 'idx_log_entity_number', fields: ['entity_number'] },
                { name: 'idx_log_type_status_time', fields: ['log_type', 'status', 'log_date_time'] },
                { name: 'idx_log_process_id', fields: ['process_id'] }
            ]
        })

    return model;
}

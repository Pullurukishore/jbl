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
            type: DataTypes.STRING
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
        })

    return model;
}
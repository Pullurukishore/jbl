'use strict';


module.exports = (sequelize, DataTypes) => {
    const model = sequelize.define('pick', {
        model_number: {
            type: DataTypes.STRING,
            allowNull: false
        },
        quantity: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        process_status: {
            type: DataTypes.ENUM(['KANBAN_IN', 'KANBAN_OUT', 'KANBAN_RTN'])
        },
        text_file_downloaded: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        entered_by: {
            type: DataTypes.STRING,
            defaultValue: 'SYSTEM',
            allowNull: false
        }
    },
        {
            engine: 'InnoDB',
            charset: 'utf8',
            underscored: false,
            paranoid: false,
            timestamps: true,
            createdAt: 'scanned_at',
            updatedAt: 'updated_at',
            freezeTableName: true,
        })

    return model;
}
'use strict';

module.exports = (sequelize, DataTypes) => {
    const model = sequelize.define('files', {
        name: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        size: {
            type: DataTypes.INTEGER,
        },
        type: {
            type: DataTypes.STRING,
        },
        path: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        created_by: {
            type: DataTypes.STRING,
            allowNull: true,
            set(value) {
                if (this.isNewRecord || !this.created_by) {
                    this.setDataValue('created_by', value);
                } else {
                    this.setDataValue('created_by', this.created_by)
                }
            }
        },
        updated_by: {
            type: DataTypes.STRING,
            allowNull: true
        },
    },
        {
            engine: 'InnoDB',
            charset: 'utf8',
            underscored: false,
            paranoid: false,
            timestamps: true,  // Automatically adds createdAt, updatedAt fields
            createdAt: 'created_date_time',
            updatedAt: 'updated_date_time',
            freezeTableName: true,
        })

    return model;
}
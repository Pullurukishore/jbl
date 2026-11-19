'use strict';

module.exports = (sequelize, DataTypes) => {
    const model = sequelize.define('bin_type', {
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        compartment_count: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        bin_name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        description: {
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

    model.afterSync(async () => {
        try {
            const count = await model.count();
            if (count === 0) {
                await model.bulkCreate([
                    { name: 'Type-A (15 Compartments)', compartment_count: 15, bin_name: 'CON_BINA', description: '15-compartment bin' },
                    { name: 'Type-B (20 Compartments)', compartment_count: 20, bin_name: 'CON_BINB', description: '20-compartment bin' },
                    { name: 'Type-C (30 Compartments)', compartment_count: 30, bin_name: 'CON_BINC', description: '30-compartment bin' },
                    { name: 'Type-D (30 Compartments - Vertical)', compartment_count: 30, bin_name: 'CON_BIND', description: 'Side bin vertical (30 Compartments)' }
                ]);
            } else {
                const conBind = await model.findOne({ where: { bin_name: 'CON_BIND' } });
                if (!conBind) {
                    await model.create({
                        name: 'Type-D (30 Compartments - Vertical)',
                        compartment_count: 30,
                        bin_name: 'CON_BIND',
                        description: 'Side bin vertical (30 Compartments)'
                    });
                }
            }
        } catch (err) {
            console.error('bin_type seed error:', err.message);
        }
    });

    return model;
};

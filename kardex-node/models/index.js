'use strict';

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const basename = path.basename(__filename);
const db = {};

// Ensure env vars are loaded even when this module is required before dotenv.config() runs in index.js
require('dotenv').config({ path: require('path').join(__dirname, '..', 'config', 'config.env') });

const sequelize = new Sequelize(process.env.DB_DATABASE, process.env.DB_USERNAME, process.env.DB_PASSWORD, {
    dialect: process.env.DB_DIALECT,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    logging: process.env.DB_LOGGING === 'true' ? console.log : false,
    dialectOptions: {
        keepAlive: true,
        connectTimeout: 20000,
    },
    pool: {
        max: parseInt(process.env.DB_POOL_MAX, 10) || 25,
        min: parseInt(process.env.DB_POOL_MIN, 10) || 2,
        acquire: parseInt(process.env.DB_POOL_ACQUIRE, 10) || 30000,
        idle: parseInt(process.env.DB_POOL_IDLE, 10) || 10000
    },
    retry: {
        match: [
            /SequelizeConnectionError/,
            /SequelizeConnectionRefusedError/,
            /SequelizeHostNotFoundError/,
            /SequelizeHostNotReachableError/,
            /SequelizeInvalidConnectionError/,
            /SequelizeConnectionTimedOutError/,
            /Connection terminated unexpectedly/,
            /ECONNRESET/,
            /ETIMEDOUT/
        ],
        max: 3
    }
});

fs
    .readdirSync(__dirname)
    .filter(file => {
        return (file.indexOf('.') !== 0) && (file !== basename) && (file.slice(-3) === '.js');
    })
    .forEach(file => {
        const model = sequelize['import'](path.join(__dirname, file));
        // console.log(file, model);
        db[model.name] = model;
    });

Object.keys(db).forEach(modelName => {
    if (db[modelName].associate) {
        db[modelName].associate(db);
    }
});

//Associations

//permissions
// db.query.hasMany(db.query_log);
//db.config_matrix.hasMany(db.master_customers);
//db.master_customer_group.hasMany(db.master_customers);
//db.master_customers.hasMany(db.master_customer_contracts);

db.put.belongsTo(db.pick, { foreignKey: 'pick_id' });
db.pick.hasMany(db.put, { foreignKey: 'pick_id' });

db.log.belongsTo(db.put, { foreignKey: 'put_id' });
db.put.hasMany(db.log, { foreignKey: 'put_id' });

db.log.belongsTo(db.pick, { foreignKey: 'pick_id' });
db.pick.hasMany(db.log, { foreignKey: 'pick_id' });

db.files.hasMany(db.pick, { as: 'pick_text_file', foreignKey: 'text_file_id' });
db.pick.belongsTo(db.files, { as: 'pick_text_file', foreignKey: 'text_file_id' });

db.files.hasMany(db.put, { as: 'put_text_file', foreignKey: 'text_file_id' });
db.put.belongsTo(db.files, { as: 'put_text_file', foreignKey: 'text_file_id' });

db.files.hasMany(db.put, { as: 'put_po_file', foreignKey: 'po_file_id' });
db.put.belongsTo(db.files, { as: 'put_po_file', foreignKey: 'po_file_id' });

// NEW: HU/Compartment associations
db.bin_type.hasMany(db.handling_unit, { foreignKey: 'bin_type_id' });
db.handling_unit.belongsTo(db.bin_type, { foreignKey: 'bin_type_id' });

db.handling_unit.hasMany(db.compartment, { foreignKey: 'handling_unit_id' });
db.compartment.belongsTo(db.handling_unit, { foreignKey: 'handling_unit_id' });

db.compartment.hasOne(db.put, { foreignKey: 'compartment_id' });
db.put.belongsTo(db.compartment, { foreignKey: 'compartment_id' });

db.handling_unit.hasMany(db.put, { foreignKey: 'handling_unit_id' });
db.put.belongsTo(db.handling_unit, { foreignKey: 'handling_unit_id' });

//users
//db.master_customer_group.belongsTo(db.config_matrix);
//db.master_customers.belongsTo(db.config_matrix);
//db.master_customers.belongsTo(db.master_customer_group);
//db.master_customer_contracts.belongsTo(db.master_customers);

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;

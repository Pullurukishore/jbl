'use strict';

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const basename = path.basename(__filename);
const db = {};

const sequelize = new Sequelize(process.env.DB_DATABASE, process.env.DB_USERNAME, process.env.DB_PASSWORD, {
    dialect: process.env.DB_DIALECT,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    logging: true
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

//users
//db.master_customer_group.belongsTo(db.config_matrix);
//db.master_customers.belongsTo(db.config_matrix);
//db.master_customers.belongsTo(db.master_customer_group);
//db.master_customer_contracts.belongsTo(db.master_customers);

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
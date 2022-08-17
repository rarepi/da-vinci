import { Sequelize, DataTypes } from 'sequelize';
import fs from 'fs';

const sequelize = new Sequelize({
    dialect: 'sqlite',
    //logging: console.log,
    logging: false,
    storage: './db/servants.db',
});

let db = {
  sequelize: sequelize
}

const modelFiles = fs.readdirSync('./db/models').filter(file => file.endsWith('.js'));
for (const file of modelFiles) {
    const model:any = require(`./db/models/${file}`)(sequelize, DataTypes);
    db[model.name] = model;
}

sequelize.sync()
  .catch((err) => {
    console.log(err);
    process.exit();
  });

module.exports = db;
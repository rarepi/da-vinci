import { Sequelize } from 'sequelize';
import fs from 'fs';

const sequelize = new Sequelize({
    dialect: 'sqlite',
    //logging: console.log,
    logging: false,
    storage: 'db/servants.db',
});

class Database extends Array<any>{
    sequelize? : Sequelize;
}

const db:any = {};

const modelFiles = fs.readdirSync('src/models').filter(file => file.endsWith('.ts'));
for (const file of modelFiles) {
    const model = require(`./models/${file}`)(sequelize);
    db[model.name] = model;
}

Object.keys(db).forEach((modelName:string) => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

console.log("Syncing DB")
sequelize.sync()
  .catch((err) => {
    console.log(err);
    process.exit();
  });

export default db;
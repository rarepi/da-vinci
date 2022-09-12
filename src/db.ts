import Sequelize from 'sequelize';
import fs from 'fs';

const sequelize = new Sequelize.Sequelize({
    dialect: 'sqlite',
    //logging: console.debug,
    logging: false,
    storage: 'db/servants.db',
    //transactionType: Transaction.TYPES.IMMEDIATE, // https://github.com/sequelize/sequelize/issues/10304
});

class Database extends Array<any>{
    sequelize? : Sequelize.Sequelize;
}

import _Class from "./models/classes"
const Class = _Class(sequelize);
import _Servant from "./models/servants"
const Servant = _Servant(sequelize);
import _Banner from "./models/banners"
const Banner = _Banner(sequelize);
import _BannerServants from "./models/bannerservants"
const BannerServant = _BannerServants(sequelize);

let models : any = {
  Class: Class,
  Servant: Servant,
  Banner: Banner,
  BannerServant: BannerServant
}

Object.keys(models).forEach((modelName:string) => {
  if (models[modelName].associate) {
    models[modelName].associate(models);
  }
});

console.info("Syncing DB")
sequelize.sync()
  .catch((err) => {
    console.error(err);
    process.exit();
  });

export default models;
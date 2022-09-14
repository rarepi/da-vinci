import Sequelize from 'sequelize';
import fs from 'fs';

export const DATABASE_UPDATE_INTERVAL = 12 * (1000 * 60 * 60);	// in milliseconds
export const DATABASE_REV_FILE = 'db/databaseRevision.json';
export interface DatabaseRevision {
    Servant: number | undefined,
    Banner: number | undefined,
    lastUpdate: number | undefined,
};

export const sequelize = new Sequelize.Sequelize({
    dialect: 'sqlite',
    //logging: console.debug,
    logging: false,
    storage: 'db/servants.db',
    //transactionType: Transaction.TYPES.IMMEDIATE, // https://github.com/sequelize/sequelize/issues/10304
});

import _Class from "./models/classes"
const Class = _Class(sequelize);
import _Servant from "./models/servants"
const Servant = _Servant(sequelize);
import _Banner from "./models/banners"
const Banner = _Banner(sequelize);
import _BannerServants from "./models/bannerservants"
const BannerServant = _BannerServants(sequelize);

let models: any = {
    Class: Class,
    Servant: Servant,
    Banner: Banner,
    BannerServant: BannerServant
}

Object.keys(models).forEach((modelName: string) => {
    if (models[modelName].associate) {
        models[modelName].associate(models);
    }
});

export default models;

export function runDatabaseScheduler(databaseUpdateTask: () => void) {
    if (DATABASE_UPDATE_INTERVAL > 2147483647) {
        console.error(`Invalid database update interval. Aborting scheduler.`)
        return;
    }
    setInterval(databaseUpdateTask, DATABASE_UPDATE_INTERVAL);
    console.info(`Starting database update scheduler. Database update scheduled for every ${DATABASE_UPDATE_INTERVAL / 1000 / 60 / 60} hours.`);
    return
}

export function setDatabaseRevision(servant?: number, banner?: number, timeofUpdate?: number) {
    let databaseRevision: DatabaseRevision | undefined = getDatabaseRevision();
    if (!databaseRevision) {
        databaseRevision = {
            Servant: servant,
            Banner: banner,
            lastUpdate: timeofUpdate
        }
    } else {
        if (servant) databaseRevision.Servant = servant;
        if (banner) databaseRevision.Banner = banner;
        if (timeofUpdate) databaseRevision.lastUpdate = timeofUpdate;
    }

    fs.writeFile(DATABASE_REV_FILE, JSON.stringify(databaseRevision), 'utf8', (err) => {
        if (err) { console.error(err); }
        else { console.log("Database revisions have been updated."); }
    });
}

export function getDatabaseRevision(): DatabaseRevision | undefined {
    let databaseRevision: DatabaseRevision | undefined;
    try {
        let data = fs.readFileSync(DATABASE_REV_FILE, 'utf8');
        databaseRevision = JSON.parse(data);
    } catch (error) {
        console.warn(error);
        console.warn(`Failed to parse "${DATABASE_REV_FILE}"`)
    }
    return databaseRevision;
}

console.info("Syncing DB")
sequelize.sync()
    .catch((err) => {
        console.error(err);
        process.exit();
    });
import Sequelize from 'sequelize';
import fs from 'fs';

const DATABASE_UPDATE_INTERVAL = 12 * (1000 * 60 * 60);	// in milliseconds
const DATABASE_REV_FILE = 'db/databaseRevision.json';
export interface DatabaseRevision {
    Servant: number | undefined,
    Banner: number | undefined,
    lastUpdate: number | undefined,
};

export const sequelize = new Sequelize.Sequelize({
    dialect: 'sqlite',
    //logging: console.debug,
    logging: false,
    storage: 'db/davinci.db',
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
import _Reminder from "./models/reminders"
const Reminder = _Reminder(sequelize);

let models: any = {
    Class: Class,
    Servant: Servant,
    Banner: Banner,
    BannerServant: BannerServant,
    Reminder: Reminder
}

Object.keys(models).forEach((modelName: string) => {
    if (models[modelName].associate) {
        models[modelName].associate(models);
    }
});

export default models;

export abstract class Database {
    static runDatabaseScheduler(databaseUpdateTask: () => void) {
        if (DATABASE_UPDATE_INTERVAL > 2147483647) {
            console.error(`Invalid database update interval. Aborting scheduler.`)
            return;
        }
        setInterval(databaseUpdateTask, DATABASE_UPDATE_INTERVAL);
        console.info(`Starting database update scheduler. Database update scheduled for every ${DATABASE_UPDATE_INTERVAL / 1000 / 60 / 60} hours.`);
        return;
    }

    static getDatabaseRevision(): DatabaseRevision | undefined {
        let databaseRevision: DatabaseRevision | undefined;
        try {
            let data = fs.readFileSync(DATABASE_REV_FILE, 'utf8');
            databaseRevision = JSON.parse(data);
        } catch (error:any) {
            if(error.code !== 'ENOENT')
                console.warn(error); // don't display the error if the file was just missing
            console.warn(`Failed to parse "${DATABASE_REV_FILE}"`)
        }
        return databaseRevision;
    }

    static setDatabaseRevision(servant?: number, banner?: number, timeofUpdate?: number) {
        let databaseRevision: DatabaseRevision | undefined = this.getDatabaseRevision();
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

    static isDatabaseUpToDate() : boolean {
        const databaseRevision = this.getDatabaseRevision();
        const updateThreshold = new Date().getTime() - DATABASE_UPDATE_INTERVAL; // current time in milliseconds minus schedule interval
        return databaseRevision != undefined && databaseRevision.lastUpdate != undefined && databaseRevision.lastUpdate > updateThreshold;
    }

    static getRevisionPath() : string {
        return DATABASE_REV_FILE;
    }

    static getUpdateInterval() : number {
        return DATABASE_UPDATE_INTERVAL;
    }
}

export async function sync() {
    console.info("Syncing DB")
    await sequelize.sync()  // this failing is fatal
        .catch((err) => {
            throw(err);     
        });
}
import Sequelize, { CreationOptional, InferAttributes, InferCreationAttributes, Model, Op } from 'sequelize';

function dateDifferenceInDays(date1: Date, date2: Date) {
    const date1_ms = Date.UTC(date1.getUTCFullYear(), date1.getUTCMonth(), date1.getUTCDate());
    const date2_ms = Date.UTC(date2.getUTCFullYear(), date2.getUTCMonth(), date2.getUTCDate());
    return Math.floor((date1_ms - date2_ms) / 1000 / 60 / 60 / 24);
}

// imported by db
module.exports = function(sequelize : Sequelize.Sequelize) {

class Banner extends Model<InferAttributes<Banner>, InferCreationAttributes<Banner>> {
	declare id: number;
	declare name: string;
    declare img: string;
	declare guaranteed: CreationOptional<boolean>;
	declare jp_start_date: CreationOptional<Date>;
	declare jp_end_date: CreationOptional<Date>;
	declare na_start_date: CreationOptional<Date>;
	declare na_end_date: CreationOptional<Date>;
	declare na_available: CreationOptional<boolean>;
    static models: any;
	//servants: number[];
    static associate(models: any) {
        this.models = models;
        Banner.belongsToMany(models.Servant, {
            through: models.BannerServants
        })
    }
    static findCurrent() : Promise<Banner[]>{
        let now = new Date().toUTCString();
        return Banner.findAll({
            //logging: console.debug,
            where: {
                na_start_date: {
                    [Op.lt]: now,
                },
                na_end_date: {
                    [Op.gt]: now
                }
            }
        })
    }

    static findNext(count:number) : Promise<Banner[]> {
        const now = new Date().toUTCString();
        return Banner.findAll({
            //logging: console.debug,
            where: {
                na_start_date: {
                    [Op.gt]: now
                }
            },
            order: [['na_start_date', 'ASC']],
            limit: count
        })
    }

    static async findMostRecentBannerWithJPStartDate() : Promise<Banner|null> {
        const now = new Date().toUTCString();
        let recentBanners = await Banner.findAll({
            //logging: console.debug,
            where: {
                na_start_date: {
                    [Op.lt]: now,
                },
                // Workaround: Using 'NOT ( ... IS NULL)'; simpler parameters like 'Op.ne undefined' or just 'Op.not undefined' produce invalid queries like 'jp_start_date != NULL' 
                [Op.not]: [{
                    jp_start_date: {
                        [Op.is]: undefined
                    }
                }]
            },
            order: [['na_start_date', 'DESC']],
            limit: 1
        });

        if(recentBanners.length == 0) {
            console.error(`findMostRecentBannerWithJPStartDate: Failed to find Banner.`);
            return null;
        }
        
        return recentBanners[0];
    }

    static async findNextPredicted(count?: number, include?: Sequelize.Includeable | Sequelize.Includeable[] | undefined) : Promise<[Banner[], number | undefined]> {
        console.debug(`Predicting upcoming banners based on JP dates...`)
        const now = new Date().toUTCString();
        let nextBannersJP: Banner[] = [];
        let predictionOffsetDays: number | undefined;

        const refBanner = await this.findMostRecentBannerWithJPStartDate();
        console.debug(`findNextPredicted: Banner used for reference: ${refBanner?.name}`);
        if(!refBanner)
            return [nextBannersJP, undefined];

        let refStartJP = refBanner.jp_start_date.toUTCString();
        // find banner with either a future NA start date or an JP start date that follows up on our recent banner's JP start date
        nextBannersJP = await Banner.findAll({
            logging: console.debug,
            include: include,
            where: {
                [Op.or]: [
                    {
                        na_start_date: {
                            [Op.gt]: now
                        }
                    },
                    {
                        jp_start_date: {
                            [Op.gt]: refStartJP,    // exclude banners that happened before our reference banner
                        },
                        [Op.or]: [
                            {
                                na_start_date: {
                                    [Op.gt]: now
                                }
                            }, {
                                na_start_date: {
                                    [Op.is]: undefined
                                }
                            }
                        ]
                    }
                ]
            },
            order: [['jp_start_date', 'ASC']],
            limit: count
        });

        predictionOffsetDays = dateDifferenceInDays(refBanner.na_start_date, refBanner.jp_start_date);
        console.debug(`FGO Japan was recently ahead of FGO NA by ${predictionOffsetDays} days.`);
        nextBannersJP = this.applyDayOffset(nextBannersJP, predictionOffsetDays);

        return [nextBannersJP, predictionOffsetDays];
    }

    static async findByServant(servantId:number|string, upcomingOnly:boolean = false, count?: number) : Promise<Banner[]>{
        let banners: Banner[];
        const include = {
            model: this.models.Servant,
            attributes: [],
            where: {
                id: servantId
            },
            through: {
                attributes: []
            }
        };

        if(upcomingOnly)
            banners = (await this.findNextPredicted(count, include))[0];
        else {
            banners = await this.findAll({ 
                include: include,
                order: [['jp_start_date', 'ASC']],
                limit: count,
                //logging: console.debug
            })
            const refBanner = await this.findMostRecentBannerWithJPStartDate();
            if(refBanner) {
                banners = this.applyDayOffset(banners, dateDifferenceInDays(refBanner.na_start_date, refBanner.jp_start_date));
            } else {
                console.error(`findByServant: Could not predict NA dates because a JP reference banner could not be found.`)
            }
        }
        
        return banners;
    }

    static applyDayOffset(banners: Banner[], dayOffset: number) {
        for(let b of banners) {
            if(!(b.na_start_date && b.na_end_date)) {
                b.na_start_date = b.jp_start_date;
                b.na_end_date = b.jp_end_date;
                // add day offset JP -> NA
                b.na_start_date.setDate(b.na_start_date.getUTCDate() + dayOffset);
                b.na_end_date.setDate(b.na_end_date.getUTCDate() + dayOffset);
            }
        }
        return banners;
    }
}

Banner.init({
    id: {
        type: Sequelize.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: false,
        allowNull: false,
        unique: true,
    },
    name: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    img: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    guaranteed: {
        type: Sequelize.BOOLEAN,
        allowNull: true,
    },
    jp_start_date: {
        type: Sequelize.DATE,
        allowNull: true,
    },
    jp_end_date: {
        type: Sequelize.DATE,
        allowNull: true,
    },
    na_start_date: {
        type: Sequelize.DATE,
        allowNull: true,
    },
    na_end_date: {
        type: Sequelize.DATE,
        allowNull: true,
    },
    na_available: {
        type: Sequelize.BOOLEAN,
        allowNull: true,
    }
}, { 
    timestamps: false,
    sequelize,
 })

return Banner;
}
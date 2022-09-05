import Sequelize, { CreationOptional, ForeignKey, InferAttributes, InferCreationAttributes, Model, Op } from 'sequelize';

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
	//servants: number[];
    static associate(models: any) {
        Banner.belongsToMany(models.Servant, {
            through: models.BannerServants
        })
    }
    static findCurrent() : Promise<Banner[]>{
        let now = new Date().toUTCString();
        return Banner.findAll({
            //logging: console.log,
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
        let now = new Date().toUTCString();
        return Banner.findAll({
            //logging: console.log,
            where: {
                na_start_date: {
                    [Op.gt]: now
                }
            },
            order: [['na_start_date', 'ASC']],
            limit: count
        })
    }

    static async findNextPredicted(count: number) : Promise<[Banner[], number | undefined]> {
        console.log(`Predicting upcoming banners based on JP dates...`)
        let now = new Date().toUTCString();
        let nextBannersJP: Banner[] = [];
        let predictionOffsetDays: number | undefined;

        // find last NA banner
        let recentBanners = await Banner.findAll({
            //logging: console.log,
            where: {
                na_start_date: {
                    [Op.lt]: now,
                },
                // na_end_date: {
                //     [Op.gt]: now
                // },
                // Workaround: 'NOT ( ... IS NULL)'; simpler parameters like Op.ne or just Op.not undefined produce invalid queries like '... != NULL' 
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
            console.error(`Failed to find reference Banner!`);
        } else {
            const refBanner = recentBanners[0];
            console.log(`Banner used for reference: ${refBanner.name}`);
            let refActualTime = Date.UTC(refBanner.na_start_date.getFullYear(), refBanner.na_start_date.getMonth(), refBanner.na_start_date.getDay());
            let refPredictionTime = Date.UTC(refBanner.jp_start_date.getFullYear()+2, refBanner.jp_start_date.getMonth(), refBanner.jp_start_date.getDay());
            predictionOffsetDays = Math.floor((refActualTime - refPredictionTime) / 1000 / 60 / 60 / 24);
            console.log(`NA was recently ahead of JP date by ${predictionOffsetDays} days.`);

            let refStartJP = refBanner.jp_start_date.toUTCString();
            // find next upcoming banner with either a future NA start date or an JP start date that follows up on our recent banner's JP start date
            nextBannersJP = await Banner.findAll({
                //logging: console.log,
                where: {
                    [Op.or]: [
                        {
                            na_start_date: {
                                [Op.gt]: now
                            }
                        },
                        {
                            jp_start_date: {
                                [Op.gt]: refStartJP,
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
        }


        return [nextBannersJP, predictionOffsetDays];
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
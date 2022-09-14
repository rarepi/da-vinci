import Sequelize, { InferAttributes, InferCreationAttributes, Model } from 'sequelize';

/**
 * Represents the association table for the Many-to-Many relationship between Banner and Servant
 */
class BannerServant extends Model<InferAttributes<BannerServant>, InferCreationAttributes<BannerServant>> {
}

// imported by db
export default function (sequelize: Sequelize.Sequelize) {
    BannerServant.init({
    }, {
        timestamps: false,
        sequelize,
    })

    return BannerServant;
}
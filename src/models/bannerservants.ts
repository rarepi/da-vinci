import Sequelize, { InferAttributes, InferCreationAttributes, Model } from 'sequelize';

// imported by db
module.exports = function(sequelize : Sequelize.Sequelize) {
    /**
     * Represents the association table for the Many-to-Many relationship between Banner and Servant
     */
    class BannerServants extends Model<InferAttributes<BannerServants>, InferCreationAttributes<BannerServants>> {
    }

    BannerServants.init({
    }, { 
        timestamps: false,
        sequelize,
    })

    return BannerServants;
}
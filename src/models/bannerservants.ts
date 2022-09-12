import Sequelize, { InferAttributes, InferCreationAttributes, Model } from 'sequelize';

/**
 * Represents the association table for the Many-to-Many relationship between Banner and Servant
 */
    class BannerServants extends Model<InferAttributes<BannerServants>, InferCreationAttributes<BannerServants>> {
}

// imported by db
module.exports = function(sequelize : Sequelize.Sequelize) {
    BannerServants.init({
    }, { 
        timestamps: false,
        sequelize,
    })

    return BannerServants;
}
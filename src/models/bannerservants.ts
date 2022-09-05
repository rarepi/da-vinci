import Sequelize, { CreationOptional, ForeignKey, InferAttributes, InferCreationAttributes, Model } from 'sequelize';

// imported by db
module.exports = function(sequelize : Sequelize.Sequelize) {

class BannerServants extends Model<InferAttributes<BannerServants>, InferCreationAttributes<BannerServants>> {

}

BannerServants.init({

}, { 
    timestamps: false,
    sequelize,
 })

return BannerServants;
}
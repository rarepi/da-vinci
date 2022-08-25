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

/*
    Servants.findByClass = function(classId:number) {
        return this.findAll({
            where: {
                classId: classId
            }
        })
    }
*/
return BannerServants;
}
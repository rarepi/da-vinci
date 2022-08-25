import Sequelize, { CreationOptional, ForeignKey, InferAttributes, InferCreationAttributes, Model } from 'sequelize';

// imported by db
module.exports = function(sequelize : Sequelize.Sequelize) {

class Banner extends Model<InferAttributes<Banner>, InferCreationAttributes<Banner>> {
	declare id: number;
	declare name: string;
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

/*
    Servants.findByClass = function(classId:number) {
        return this.findAll({
            where: {
                classId: classId
            }
        })
    }
*/
return Banner;
}
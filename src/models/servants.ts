import Sequelize, { CreationOptional, ForeignKey, InferAttributes, InferCreationAttributes, Model } from 'sequelize';

// imported by db
module.exports = function(sequelize : Sequelize.Sequelize) {

class Servant extends Model<InferAttributes<Servant>, InferCreationAttributes<Servant>> {
    declare id: number;
    declare name: string;
    declare url: CreationOptional<string>;
    declare card0: CreationOptional<string>;
    declare card1: CreationOptional<string>;
    declare card2: CreationOptional<string>;
    declare card3: CreationOptional<string>;
    declare card4: CreationOptional<string>;
    declare rarity: CreationOptional<number>;
    static associate(models: any) {
        Servant.belongsTo(models.Class, { 
            foreignKey: {
                name: 'class',
                allowNull: true,
            }
        }),
        Servant.belongsToMany(models.Banner, {
            through: models.BannerServants
        })
    }
}

Servant.init({
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
    url: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    card0: {
        type: Sequelize.CHAR(1),
        allowNull: true,
        unique: false,
    },
    card1: {
        type: Sequelize.CHAR(1),
        allowNull: true,
        unique: false,
    },
    card2: {
        type: Sequelize.CHAR(1),
        allowNull: true,
        unique: false,
    },
    card3: {
        type: Sequelize.CHAR(1),
        allowNull: true,
        unique: false,
    },
    card4: {
        type: Sequelize.CHAR(1),
        allowNull: true,
        unique: false,
    },
    rarity: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        unique: false,
    },
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
return Servant;
}
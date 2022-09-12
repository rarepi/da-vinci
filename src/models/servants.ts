import Sequelize, { CreationOptional, InferAttributes, InferCreationAttributes, Model, Op } from 'sequelize';

// imported by db
module.exports = function(sequelize : Sequelize.Sequelize) {

    /**
     * Represents a servant character in FGO
     */
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
        static models: any;

        /**
         * Sets up the Many-to-Many associtation between Servant and Class, and Servant and Banner
         * @param {any} models Map of sequelize models
         */
        static associate(models: any) {
            this.models = models;
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

        /**
         * Obtains all servants whose names match the specified name.
         * @param {string} name The full or partial name of the desired servant
         * @returns {Promise<Banner[]>}
         */
        static findByName(name:string) : Promise<Servant[]>{
            let nameLower = name.toLowerCase();
            return Servant.findAll({
                logging: console.debug,
                where: sequelize.where(sequelize.fn('LOWER', sequelize.col('name')), 'LIKE', `%${nameLower}%`)
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
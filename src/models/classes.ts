import Sequelize, { CreationOptional, InferAttributes, InferCreationAttributes, Model } from 'sequelize';

// imported by db
module.exports = function(sequelize : Sequelize.Sequelize) {
    class Class extends Model<InferAttributes<Class>, InferCreationAttributes<Class>> {
        declare id: CreationOptional<number>;
        declare name: string;
        static associate(models: any) {
/*             Class.hasMany(models.Servant, {
                foreignKey: {
                    name: "class",
                    allowNull: true,
                }
            }); */
        }
    }

    Class.init({
        id: {
            type: Sequelize.INTEGER.UNSIGNED,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false,
            unique: true,
        },
        name: {
            type: Sequelize.STRING,
            allowNull: false,
            unique: true,
        },
    }, {
        timestamps: false,
        sequelize,
    })
    return Class;
}
import Sequelize, { CreationOptional, InferAttributes, InferCreationAttributes, Model } from 'sequelize';

class Class extends Model<InferAttributes<Class>, InferCreationAttributes<Class>> {
    declare id: CreationOptional<number>;
    declare name: string;
    static associate(models: any) {

    }
}

// imported by db
export default function (sequelize: Sequelize.Sequelize) {
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
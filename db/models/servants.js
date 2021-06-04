const Sequelize = require('sequelize');

module.exports = function(sequelize, DataTypes){
    const ServantClasses = require(`./classes.js`)(sequelize, DataTypes);
    const servants = sequelize.define('servants', {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false,
            unique: true,
        },
        name: {
            type: Sequelize.TEXT,
            allowNull: false,
            unique: true,
        },
        shortName: {
            type: Sequelize.TEXT,
            allowNull: true,
        },
        fandomURL: {
            type: Sequelize.TEXT,
            allowNull: false,
            unique: true,
        },
        class: {
            type: Sequelize.TEXT,
            allowNull: false,
            references: {
                model: ServantClasses,
                key: 'iconId',
            }
        },
    },
    {
        timestamps: false,
        underscored: false,
    });

    servants.findByClass = function(classId) {
        return this.findAll({
            where: {
                class: classId
            }
        })
    }

    return servants;
}


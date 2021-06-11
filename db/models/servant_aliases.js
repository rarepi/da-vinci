const Sequelize = require('sequelize');

module.exports = function(sequelize, DataTypes){
    const ServantAliases = sequelize.define('servant_aliases', {
        servantId: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            allowNull: false,
        },
        alias: {
            type: Sequelize.TEXT,
            primaryKey: true,
            allowNull: false,
        },
    },
    {
        timestamps: false,
        underscored: false,
    });

    ServantAliases.findByServantId = function(servantId) {
        return this.findAll({
            where: {
                servantId: servantId
            }
        })
    }

    return ServantAliases;
}


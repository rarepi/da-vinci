const Sequelize = require('sequelize');

module.exports = function(sequelize, DataTypes){
    const Classes = sequelize.define('classes', {
        iconId: {
            type: Sequelize.TEXT,
            primaryKey: true,
            allowNull: false,
            unique: true,
        },
        name: {
            type: Sequelize.TEXT,
            allowNull: false,
            unique: true,
        },
        group: {
            type: Sequelize.INTEGER,
            defaultValue: 0,
        },
    },
    {
        timestamps: false,
        underscored: false,
    });
    return Classes;
}
const Sequelize = require('sequelize');

module.exports = function(sequelize, DataTypes){
    const classes = sequelize.define('classes', {
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
    },
    {
        timestamps: false,
        underscored: false,
    });
    return classes;
}
const Sequelize = require('sequelize');

module.exports = function(sequelize, DataTypes){
    const ServantClasses = require(`./classes.js`)(sequelize, DataTypes);
    const ServantAliases = require('./servant_aliases.js')(sequelize, DataTypes);
    const Servants = sequelize.define('servants', {
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
    },
    {
        timestamps: false,
        underscored: false,
    });

    ServantClasses.hasMany(Servants, {
        foreignKey: {
            name: "classId",
            allowNull: false,
        }
    });
    Servants.belongsTo(ServantClasses, {
        foreignKey: {
            name: "classId",
            allowNull: false,
        }
    });

    Servants.hasMany(ServantAliases, {
        foreignKey: {
            name: "servantId",
        }
    });
    ServantAliases.belongsTo(Servants);

    Servants.findByClass = function(classId) {
        return this.findAll({
            where: {
                classId: classId
            }
        })
    }

    // finds by name or alias name
    Servants.findByName = function(name) {
        return this.findAll({
            include: [{
                model: ServantAliases,
                required: false,
                attributes: [],
                where: {
                    alias: {
                        [Sequelize.Op.like]: `%${name}%`
                    }
                }
                }],
            where: {
                [Sequelize.Op.or]: {
                    name: {
                        [Sequelize.Op.like]: `%${name}%`
                    },
                    "$servant_aliases.alias$": {
                        [Sequelize.Op.like]: `%${name}%`
                    }
                }
            }
        })
    }

    return Servants;
}


const Sequelize = require('sequelize');

module.exports = function(sequelize, DataTypes){
    const Servants = require(`./servants.js`)(sequelize, DataTypes);
    const Sheets = sequelize.define('sheets', {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false,
            unique: true,
        },
        path: {
            type: Sequelize.TEXT,
            allowNull: false,
            unique: true,
        },
        description: {
            type: Sequelize.TEXT,
            allowNull: false,
            unique: true,
        },
        bodyWidth: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 1024,
        },
        bodyHeight: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 768,
        },
        headX: {
            type: Sequelize.INTEGER,
            allowNull: true,
        },
        headY: {
            type: Sequelize.INTEGER,
            allowNull: true,
        },
        eWidth: {
            type: Sequelize.INTEGER,
            allowNull: true,
        },
        eHeight: {
            type: Sequelize.INTEGER,
            allowNull: true,
        },
        dialogOffsetX: {
            type: Sequelize.INTEGER,
            allowNull: true,
        },
        dialogOffsetY: {
            type: Sequelize.INTEGER,
            allowNull: true,
        },
        specialFormat: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0,
        },
        certainty: {
            type: Sequelize.FLOAT,
            allowNull: false,
            defaultValue: 0.0,
        },
    },
    {
        timestamps: false,
        underscored: false,
    });

    Servants.hasMany(Sheets, {
        foreignKey: {
            name: "servantId",
            allowNull: false,
        }
    });
    Sheets.belongsTo(Servants);

    Sheets.findSheetsForDisplay = function(servantId) {
        return this.findAll({
            where: {
                servantId: servantId,
                specialFormat: {
                    // only normal body+expressions or full-body sheets are supported at the moment
                    [Sequelize.Op.or]: [0, 1]
                  }
            },
            attributes: [
                'id',
                ['description', 'name'],
                'dialogOffsetX',
                'dialogOffsetY',
                'certainty'
            ]
        })
    }

    // checks if expressions have been set for this sheet.
    Sheets.prototype.hasExpressions = function() {
        return this.eWidth > 0 && this.eHeight > 0 && this.headX != null && this.headY != null
    }

    Sheets.prototype.status = function() {
        if(typeof(this.dialogOffsetX) === 'undefined'
            || typeof(this.dialogOffsetY) === 'undefined'
            || typeof(this.certainty) === 'undefined') {
                throw('status requires \'dialogOffsetX\', \'dialogOffsetY\' and \'certainty\' to be fetched. ')
            }
        return this.dialogOffsetX != null
            && this.dialogOffsetY != null
            && this.certainty >= 0.99;
        }

    return Sheets;
}
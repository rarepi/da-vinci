import Sequelize, { CreationOptional, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { DateTime } from 'luxon';

export enum TimerType {
    INTERVAL = 1,
    TIMEOUT = 2
} 

export class Reminder extends Model<InferAttributes<Reminder>, InferCreationAttributes<Reminder>> {
    declare id: number;
    declare userId: string;
    declare channelId: CreationOptional<string>;
    declare timerType: CreationOptional<TimerType>;
    declare repeat: number;
    declare time: Date;
    declare text: CreationOptional<string>;
    declare timer: NodeJS.Timeout | NodeJS.Timer | undefined;
    static associate(models: any) {

    }
}

// imported by db
export default function (sequelize: Sequelize.Sequelize) {
    Reminder.init({
        id: {
            type: Sequelize.INTEGER.UNSIGNED,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false,
            unique: true,
        },
        userId: {
            type: Sequelize.STRING,
            allowNull: false,
            unique: false
        },
        channelId: {
            type: Sequelize.STRING,
            allowNull: true,
            unique: false
        },
        time: {
            type: Sequelize.DATE,
            allowNull: false,
            unique: false,
        },
        timerType: {
            type: Sequelize.INTEGER,
            allowNull: true,
            unique: false
        },
        repeat: {
            type: Sequelize.INTEGER,
            allowNull: false,
            unique: false
        },
        text: {
            type: Sequelize.STRING,
            allowNull: true,
            unique: false
        },
        timer: {
            type: Sequelize.VIRTUAL,
        },
    }, {
        timestamps: false,
        sequelize,
    })
    return Reminder;
}
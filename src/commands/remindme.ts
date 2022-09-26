import Discord from "discord.js"
import { SlashCommandBuilder } from '@discordjs/builders';
import { DateTime } from 'luxon';
import databaseModels from '../db';
import { Reminder } from "../models/reminders";
import { NamedTimeZones } from "../timezones";
import { LongTimer } from "../longTimer";

const ReminderModel = databaseModels.Reminder;

async function createReminder(userId: string, channelId: string | undefined, repeat: TimeType | null, time: DateTime, text: string | null) : Promise<Reminder> {
    return await ReminderModel.create({
        userId: userId,
        channelId: channelId,
        repeat: repeat,
        time: time,
        text: text
    });
}

enum TimeType {
    none = 0,
    year = 1,
    month = 2,
    week = 3,
    day = 4,
    hour = 5,
    minute = 6,
    second = 7,
    millisecond = 8,
    custom = 9  // custom time given in ms
}

// virtual fields can not be retrieved by fetching from database, so this Map stores a copy of every active reminder including their running timers
const ActiveReminders = new Map<number, Reminder>();

async function startupReminders(client: Discord.Client) {
    const Reminders : Reminder[] = await ReminderModel.findAll();

    console.info(`Initiating ${Reminders.length} reminders...`)
    for (const reminder of Reminders) {
        const now = DateTime.now();     // sets a new "now" every time a new reminder is looked at
        let futureTime = DateTime.fromJSDate(reminder.time);
        const user = await client.users.fetch(reminder.userId);
        const channel = await client.channels.fetch(reminder.channelId) as Discord.TextBasedChannel;

        if (!reminder.repeat) {  // if reminder is executed only once
            const msToFutureTime = futureTime.toMillis() - now.toMillis();
            if (msToFutureTime <= 0) {   // if reminder date has passed already
                // send notification with notice of it happening late
                const notification = await notifyUser(user, channel, reminder);
                await notification?.edit(`${notification.content}\n\nNote: This reminder was originally scheduled for ${futureTime.toLocaleString(DateTime.DATETIME_SHORT_WITH_SECONDS)} but I was unavailable at the time. Sorry!`)
                cancelReminder(reminder.id, user);
            } else {    // reminder date lies in the future
                console.debug(`Reminder #${reminder.id} set to ${msToFutureTime/1000} seconds.`);
                // schedule reminder once
                const timer = new LongTimer(
                    async () => {
                        await notifyUser(user, channel, reminder);
                        cancelReminder(reminder.id, user);
                    },
                    msToFutureTime
                )
                timer.start();
                reminder.timer = timer;
                ActiveReminders.set(reminder.id, reminder);
            }

        } else if (reminder.repeat) {                                       // if reminder is on repeat
            let msToFutureTime = futureTime.toMillis() - now.toMillis();            // ms between "now" and next timeout
            if(msToFutureTime <= 0) {                                               // if reminder date has passed already, send notification with notice of it happening late
                const notification = await notifyUser(user, channel, reminder);
                await notification?.edit(`${notification.content}\n\nNote: This repeated reminder was originally scheduled next for ${futureTime.toLocaleString(DateTime.DATETIME_SHORT_WITH_SECONDS)} but I was unavailable at the time. Sorry!`)

                while (msToFutureTime < 0) {     // find next future notification date
                    futureTime = getNextTimeoutDateIteration(reminder.repeat, futureTime);
                    msToFutureTime = futureTime.toMillis() - now.toMillis();
                }
            }

            if (reminder.repeat === TimeType.custom) {
                reminder.destroy();                         // TODO resumption of custom length repeated timers is currently not supported
                console.info(`Custom length Reminder #${reminder.id} has been purged due to missing implementations.`);
            } else {
                console.debug(`Reminder #${reminder.id} set to ${msToFutureTime/1000} seconds. Set to repeat every ${TimeType[reminder.repeat]}.`);
                // schedule repeated reminder in relation to first date
                const timer = new LongTimer(
                    () => {
                        notifyUser(user, channel, reminder);
                        setNextReminderTimeout(
                            () => notifyUser(user, channel, reminder),
                            reminder,
                            reminder.repeat
                        );
                    },
                    msToFutureTime
                )
                timer.start();
                reminder.timer = timer;
                ActiveReminders.set(reminder.id, reminder);
            }
        }
    }
}

async function cancelReminder(id: number, user: Discord.User) : Promise<boolean> {
    // get database instance and check if user calling this is the owner
    const reminder = await Reminder.findByPk(id);
    if (!reminder || reminder.userId !== user.id)
        return false;

    // clear active timer
    ActiveReminders.get(id)?.timer?.cancel();
    // delete reminder from map
    ActiveReminders.delete(id);

    // delete from database
    await reminder.destroy();
    console.debug(`Reminder #${id} has been destroyed.`)
    return true;
}

async function notifyUser(user: Discord.User, channel: Discord.TextBasedChannel | null, reminder: Reminder) : Promise<Discord.Message | null> {
    let text = reminder.text ?? `This is your scheduled notification.\nThere was no message provided.`;
    if (reminder.repeat)
        text = text.concat(`\n\nTo cancel this repeatedly scheduled reminder, use \`/remindme cancel ${reminder.id}\``)
        
    if (channel)
        return await channel.send(`${user.toString()} ${text}`);
    else
        ; // TODO
    return null;
}

function getNextTimeoutDateIteration(timeType: TimeType, timeoutDate: DateTime) : DateTime {
    switch (timeType) {
        case TimeType.year:
            return timeoutDate.plus({ years: 1 });
        case TimeType.month:
            return timeoutDate.plus({ months: 1 });
        case TimeType.week:
            return timeoutDate.plus({ week: 1 });
        case TimeType.day:
            return timeoutDate.plus({ days: 1 });
        case TimeType.hour:
            return timeoutDate.plus({ hours: 1 });
        case TimeType.minute:
            return timeoutDate.plus({ minutes: 1 });
        case TimeType.second:
            return timeoutDate.plus({ seconds: 1 });
        default:
            console.error(`getNextTimeout: Unknown TimeType: ${timeType}`)
            return DateTime.invalid(`Unknown TimeType: ${timeType}`);
    }
}
async function setNextReminderTimeout(callback: () => void, reminder: Reminder, timeType: TimeType) {
    const nextTimeoutDate = getNextTimeoutDateIteration(timeType, DateTime.fromJSDate(reminder.time));
    const now = DateTime.now();
    console.debug("Scheduling next timeout");
    // set next timer
    reminder.timer?.cancel();
    reminder.timer = new LongTimer(
        () => {
            callback();
            setNextReminderTimeout(callback, reminder, timeType);
        },
        nextTimeoutDate.toMillis() - now.toMillis()
    );
    reminder.timer.start();
    // replace old timeout data
    reminder.time = nextTimeoutDate.toJSDate();
    reminder = await reminder.save();
    ActiveReminders.set(reminder.id, reminder);   // TODO don't know if this is necessary - test without
}

module.exports = {
    startupReminders: startupReminders,
    data: new SlashCommandBuilder()
        .setName('remindme')
        .setDescription('Sets a reminder for the given time, at which you will be notified.')
        .addSubcommand(cmd => cmd
            .setName('at')
            .setDescription('Sends a reminder at a specified time.')
            .addIntegerOption(option => option
                .setName('year')
                .setDescription('The year at which you want to be notified.')
                .setRequired(true)
                .setMinValue(1970)
                .setMaxValue(9999)  // TODO: proper limit
                .setNameLocalization('en-US', 'year')
                .setNameLocalization('en-GB', 'year')
                .setNameLocalization('de', 'jahr')
            )
            .addIntegerOption(option => option
                .setName('month')
                .setDescription('The month at which you want to be notified.')
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(12)
                .setNameLocalization('en-US', 'month')
                .setNameLocalization('en-GB', 'month')
                .setNameLocalization('de', 'monat')
            )
            .addIntegerOption(option => option
                .setName('day')
                .setDescription('The day at which you want to be notified.')
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(31)
                .setNameLocalization('en-US', 'day')
                .setNameLocalization('en-GB', 'day')
                .setNameLocalization('de', 'tag')
            )
            .addIntegerOption(option => option
                .setName('hour')
                .setDescription('The amount of hours at which you want to be notified.')
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(23)
                .setNameLocalization('en-US', 'hour')
                .setNameLocalization('en-GB', 'hour')
                .setNameLocalization('de', 'stunde')
            )
            .addIntegerOption(option => option
                .setName('minute')
                .setDescription('The amount of minutes at which you want to be notified.')
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(59)
                .setNameLocalization('en-US', 'minute')
                .setNameLocalization('en-GB', 'minute')
                .setNameLocalization('de', 'minute')
            )
            .addIntegerOption(option => option
                .setName('second')
                .setDescription('The amount of seconds at which you want to be notified.')
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(59)
                .setNameLocalization('en-US', 'second')
                .setNameLocalization('en-GB', 'second')
                .setNameLocalization('de', 'sekunde')
            )
            .addStringOption(option => option
                .setName('timezone')
                .setDescription('In what timezone is the given time?')
                .setRequired(false)
                .setAutocomplete(true)
            )
            .addIntegerOption(option => option
                .setName('repeat')
                .setDescription('When should I repeat this reminder afterwards?')
                .setRequired(false)
                .addChoices(
                    {name: 'never', value: TimeType.none},
                    {name: 'every minute', value: TimeType.minute},
                    {name: 'every hour', value: TimeType.hour},
                    {name: 'every day', value: TimeType.day},
                    {name: 'every week', value: TimeType.week},
                    {name: 'every month', value: TimeType.month},
                    {name: 'every year', value: TimeType.year},
                )
            )
            .addStringOption(option => option
                .setName('text')
                .setDescription('An optional text to be sent with the reminder.')
                .setRequired(false)
            ),
        )
        .addSubcommand(cmd => cmd
            .setName('in')
            .setDescription('Sends a reminder after a specified time.')
            .addIntegerOption(option => option
                .setName('year')
                .setDescription('How many years till I should notify you?')
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(9999)  // TODO: proper limit
                .setNameLocalization('en-US', 'years')
                .setNameLocalization('en-GB', 'years')
                .setNameLocalization('de', 'jahren')
            )
            .addIntegerOption(option => option
                .setName('month')
                .setDescription('How many months till I should notify you?')
                .setRequired(true)
                .setMinValue(0)
                .setNameLocalization('en-US', 'months')
                .setNameLocalization('en-GB', 'months')
                .setNameLocalization('de', 'monaten')
            )
            .addIntegerOption(option => option
                .setName('day')
                .setDescription('How many days till I should notify you?')
                .setRequired(true)
                .setMinValue(0)
                .setNameLocalization('en-US', 'days')
                .setNameLocalization('en-GB', 'days')
                .setNameLocalization('de', 'tagen')
            )
            .addIntegerOption(option => option
                .setName('hour')
                .setDescription('How many hours till I should notify you?')
                .setRequired(true)
                .setMinValue(0)
                .setNameLocalization('en-US', 'hours')
                .setNameLocalization('en-GB', 'hours')
                .setNameLocalization('de', 'stunden')
            )
            .addIntegerOption(option => option
                .setName('minute')
                .setDescription('How many minutes till I should notify you?')
                .setRequired(true)
                .setMinValue(0)
                .setNameLocalization('en-US', 'minutes')
                .setNameLocalization('en-GB', 'minutes')
                .setNameLocalization('de', 'minuten')
            )
            .addIntegerOption(option => option
                .setName('second')
                .setDescription('How many seconds till I should notify you?')
                .setRequired(true)
                .setMinValue(0)
                .setNameLocalization('en-US', 'seconds')
                .setNameLocalization('en-GB', 'seconds')
                .setNameLocalization('de', 'sekunden')
            )
            .addIntegerOption(option => option
                .setName('repeat')
                .setDescription('Should I repeat this reminder?')
                .setRequired(false)
                .addChoices(
                    {name: 'no', value: 0},
                    {name: 'yes', value: 9}
                )
            )
            .addStringOption(option => option
                .setName('text')
                .setDescription('An optional text to be sent with the reminder.')
                .setRequired(false)
            ),
        )
        .addSubcommand(cmd => cmd
            .setName('cancel')
            .setDescription('Cancels a reminder')
            .addIntegerOption(option => option
                .setName('id')
                .setDescription('ID of the reminder')
            )
        ),
    /**
     * Executes the command
     * @param {Discord.ChatInputCommandInteraction} interaction The Discord interaction that called this command
     */
    async execute(interaction: Discord.ChatInputCommandInteraction) {
        // TODO: DM has no channel
        const now = DateTime.fromJSDate(interaction.createdAt);
        await interaction.deferReply();
        const cmd = interaction.options.getSubcommand();

        if (cmd === 'cancel') {
            const id = interaction.options.getInteger('id', true);
            if (await cancelReminder(id, interaction.user))
                await interaction.editReply(`Your Reminder #${id} has been canceled.`);
            else
                await interaction.editReply(`You don't have a reminder with id #${id}.`);
        } else if (cmd === 'at' || cmd === 'in') {
            const year = interaction.options.getInteger('year', true);
            const month = interaction.options.getInteger('month', true);
            const day = interaction.options.getInteger('day', true);
            const hour = interaction.options.getInteger('hour', true);
            const minute = interaction.options.getInteger('minute', true);
            const second = interaction.options.getInteger('second', true);
            const timezone = interaction.options.getString('timezone') ?? undefined;
            const _repeatTimeType = interaction.options.getInteger('repeat');   // aux
            const repeatTimeType: TimeType | null = (_repeatTimeType && _repeatTimeType > 0) ? _repeatTimeType : null ;   // null if no repetition
            const text = interaction.options.getString('text');

            let futureTime : DateTime;
            if (cmd === 'at') {
                futureTime = DateTime.now();
                if(timezone) futureTime.setZone(timezone);
                futureTime = futureTime.set({year: year, month: month, day: day, hour: hour, minute: minute, second: second})
            } else if (cmd === 'in') {
                futureTime = now.plus({
                    years: year,
                    months: month,
                    days: day,
                    hours: hour,
                    minutes: minute,
                    seconds: second
                })
            } else {
                console.error(`remindme: Invalid subcommand: ${cmd}`);
                return;
            }

            // create reminder in database
            const reminder = await createReminder(
                interaction.user.id,
                interaction.channel?.id,
                repeatTimeType,
                futureTime,
                text
            );

            // calculate milliseconds till reminder date
            const msToFutureTime = futureTime.toMillis() - now.toMillis();

            // send confirmation / rejection message
            if (msToFutureTime > 0) {
                let confirmationMsg: string;
                const futureDateString: string = `${futureTime.toLocaleString(DateTime.DATETIME_SHORT_WITH_SECONDS)} (${futureTime.zoneName})`;
                if(!repeatTimeType) {
                    confirmationMsg = `Alright! I'll notify you on **${futureDateString}**.`;
                } else if (repeatTimeType === TimeType.custom) {
                    confirmationMsg = `Alright! I'll notify you every ${Math.ceil(msToFutureTime/1000)} seconds. First notification will be on **${futureDateString}**.`;
                } else {
                    confirmationMsg = `Alright! I'll notify you on **${futureDateString}**`
                        + ` and will then continue doing so every ${TimeType[reminder.repeat]}.`;
                }
                confirmationMsg = confirmationMsg.concat(`\nYou can cancel this reminder by using: \`/remindme cancel ${reminder.id}\``);
                interaction.editReply(confirmationMsg)
            } else {
                interaction.editReply(`Sorry, I can't notify you in the past.\n...\n...or can I?`);
                return;
            }

            // create timer and add timer to timer collection
            if(repeatTimeType == 9) {  // 9 == run every msToFutureTime milliseconds on repeat
                const timer = new LongTimer(
                    () => notifyUser(interaction.user, interaction.channel, reminder),
                    msToFutureTime,
                    repeatTimeType > 0
                );
                timer.start();
                reminder.timer = timer;
            } else if(cmd === 'at' && repeatTimeType) { // run every repeatType on repeat
                const timer = new LongTimer(
                    () => {
                        notifyUser(interaction.user, interaction.channel, reminder);
                        setNextReminderTimeout(
                            () => notifyUser(interaction.user, interaction.channel, reminder),
                            reminder,
                            repeatTimeType
                        );
                    },
                    msToFutureTime,
                    repeatTimeType > 0
                );
                timer.start();
                reminder.timer = timer;
            } else {
                const timer = new LongTimer(
                    () => {
                        notifyUser(interaction.user, interaction.channel, reminder);
                        cancelReminder(reminder.id, interaction.user);
                    },
                    msToFutureTime,
                    repeatTimeType != null
                );
                timer.start();
                reminder.timer = timer;
            }
            // add reminder to active reminders and persist it to database
            ActiveReminders.set(reminder.id, reminder);
            reminder.save();
        }
    },
    async autocomplete(interaction: Discord.AutocompleteInteraction) {
        const focusedValue = interaction.options.getFocused();

		const filtered = NamedTimeZones.filter(ntz => ntz.shortName.startsWith(focusedValue));
		await interaction.respond(
			filtered.slice(0,25).map(ntz => ({ name: `${ntz.shortName}: ${ntz.fullName} (${ntz.UTCOffset})`, value: ntz.UTCOffset })),
        );
    }
};
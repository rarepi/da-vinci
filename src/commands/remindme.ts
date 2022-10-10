import Discord from "discord.js"
import { SlashCommandBuilder } from '@discordjs/builders';
import { DateTime } from 'luxon';
import { NamedTimeZones } from "../timezones";
import { LongTimer } from "../longTimer";
import * as DiscordUtils from "../DiscordUtils";

import databaseModels from '../db';
import { Reminder } from "../models/reminders"; // imported solely to avoid having to deal with 'any' typing of ReminderModel
const ReminderModel = databaseModels.Reminder;

/**
 * Returns a new persistent Reminder object
 * @param {string} userId Discord ID of the user creating the reminder
 * @param {string | undefined} channelId Discord ID of the channel this reminder was created in
 * @param {TimeType | null} repeat Enum indicating the type of repeating schedule this reminder should have
 * @param {DateTime} time First date this reminder is due on
 * @param {string | null} text Text that should be send with the reminder message
 * @param {boolean} isPrivate Whether or not the reminder should be sent in private
 * @returns {Promise<Reminder>} A persistent Reminder
 */
async function createReminder(userId: string, channelId: string | undefined, repeat: TimeType | null, time: DateTime, text: string | null, isPrivate: boolean) : Promise<Reminder> {
    return await ReminderModel.create({
        userId: userId,
        channelId: channelId,
        repeat: repeat,
        time: time,
        text: text,
        private: isPrivate
    });
}

/**
 * An enum indicating the useable types of time for repeated scheduling
 * @readonly
 * @enum {number}
 */
enum TimeType {
    /** No repeated scheduling */
    none = 0,
    year = 1,
    month = 2,
    week = 3,
    day = 4,
    hour = 5,
    minute = 6,
    second = 7,
    millisecond = 8,
    /** A custom amount of milliseconds */
    custom = 9
}

/** Stores a copy of every active reminder, each including a running timer */
const ActiveReminders = new Map<number, Reminder>(); // virtual field 'timer' of Reminder class cannot be retrieved from database, so we have to store the runtime objects TODO maybe just map Reminder id to timer and remove the virtual field?

/**
 * Activates any reminders stored in database. This starts a timer for every reminder and catches up with possibly overdue reminders.
 * 
 * To be used on startup and can thus not be called if there are active reminders running. 
 * @param {Discord.Client} client Discord client instance
 */
async function startupReminders(client: Discord.Client) {
    if(ActiveReminders.size > 0) {
        console.warn("Reminder startup function has been called but there are reminders active already. Function call has been cancelled.");
        return;
    }

    const Reminders : Reminder[] = await ReminderModel.findAll();

    console.info(`Initiating ${Reminders.length} reminders...`);
    for (const reminder of Reminders) {
        const now = DateTime.now();     // sets a new "now" every time a new reminder is looked at
        let futureTime = DateTime.fromJSDate(reminder.time);
        const user = await client.users.fetch(reminder.userId);
        const channel = await client.channels.fetch(reminder.channelId) as Discord.TextBasedChannel;

        if (!reminder.repeat) {  // if reminder is executed only once
            const msToFutureTime = futureTime.toMillis() - now.toMillis();
            if (msToFutureTime <= 0) {   // if reminder date has passed already
                // send notification with notice of it happening late
                const notification = await sendReminderMessage(user, channel, reminder);
                await notification?.edit(`${notification.content}\n\nNote: This reminder was originally scheduled for ${futureTime.toLocaleString(DateTime.DATETIME_SHORT_WITH_SECONDS)} (${futureTime.zoneName}) but I was unavailable at the time.`);
                cancelReminder(reminder.id, user);
            } else {    // reminder date lies in the future
                console.debug(`Reminder #${reminder.id} set to ${msToFutureTime/1000} seconds.`);
                // schedule reminder once
                const timer = new LongTimer(
                    async () => {
                        await sendReminderMessage(user, channel, reminder);
                        cancelReminder(reminder.id, user);
                    },
                    msToFutureTime
                );
                timer.start();
                reminder.timer = timer;
                ActiveReminders.set(reminder.id, reminder);
            }

        } else if (reminder.repeat) {                                       // if reminder is on repeat
            let msToFutureTime = futureTime.toMillis() - now.toMillis();            // ms between "now" and next timeout
            if(msToFutureTime <= 0) {                                               // if reminder date has passed already, send notification with notice of it happening late
                const notification = await sendReminderMessage(user, channel, reminder);
                await notification?.edit(`${notification.content}\nNote: This repeated reminder was originally scheduled next for ${futureTime.toLocaleString(DateTime.DATETIME_SHORT_WITH_SECONDS)} (${futureTime.zoneName}) but I was unavailable at the time.`);

                while (msToFutureTime < 0) {     // find next future notification date
                    futureTime = getNextScheduleDate(reminder.repeat, futureTime);
                    msToFutureTime = futureTime.toMillis() - now.toMillis();
                }
                reminder.time = futureTime.toJSDate();
            }

            if (reminder.repeat === TimeType.custom) {
                reminder.destroy();                         // TODO resumption of custom length repeated timers is currently not supported
                console.info(`Custom length Reminder #${reminder.id} has been purged due to missing implementations.`);
            } else {
                console.debug(`Reminder #${reminder.id} set to ${msToFutureTime/1000} seconds. Set to repeat every ${TimeType[reminder.repeat]}.`);
                // schedule reminder message and then the repeated reminder in relation to first date
                const timer = new LongTimer(
                    () => {
                        sendReminderMessage(user, channel, reminder);
                        scheduleReminderInterval(client, reminder);
                    },
                    msToFutureTime
                )
                timer.start();
                reminder.timer = timer;
                ActiveReminders.set(reminder.id, reminder);
            }
        }
        reminder.save();    // persist any reminder changes to db 
    }
    console.info(`${ActiveReminders.size} reminders are now active.`);
}

/**
 * Cancels a reminder by id, if the given Discord user is the author of the reminder.
 * 
 * This effectively deletes the database instance, removes it from active reminders and stops the associated timer.
 * @param {number} id Id of the reminder to be cancelled
 * @param {Discord.User} user Discord user who invoked the function call
 * @returns {Promise<boolean>} Whether or not a reminder has been cancelled
 */
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

/**
 * Sends the message acting as the scheduled reminder to the user
 * @param {Discord.User} user Discord user to be messaged
 * @param {Discord.User} channel Discord channel the message will be sent in
 * @param {Discord.User} reminder Reminder that is being executed
 * @returns {Promise<Discord.Message | null>} The message that was sent
 */
// TODO: reminder has user and channel id, so this function just needs a client to fetch those. what's more elegant?
async function sendReminderMessage(user: Discord.User, channel: Discord.TextBasedChannel | null, reminder: Reminder) : Promise<Discord.Message | null> {
    let text = reminder.text ?? `This is your scheduled notification. There was no message provided.`;
    if (reminder.repeat)
        text = text.concat(`\n\nTo cancel this repeatedly scheduled reminder, use \`/remindme cancel ${reminder.id}\`.`);

    const messageContent = `${user.toString()} ${text}`;

    if (channel && !reminder.private)
        return await channel.send({ content: messageContent });
    else
        return await DiscordUtils.sendDirectMessage(user.client, user.id, messageContent) ?? null;   // fails without crash if user has DMs disabled
}

/**
 * Returns the next schedule date
 * @param {TimeType} timeType Enum indicating the time difference the new date will have (e.g. TimeType.month to iterate the current schedule date by a month)
 * @param {DateTime} currentScheduleDate Current schedule date
 * @returns {DateTime} The next schedule date
 */
function getNextScheduleDate(timeType: TimeType, currentScheduleDate: DateTime) : DateTime {
    switch (timeType) {
        case TimeType.year:
            return currentScheduleDate.plus({ years: 1 });
        case TimeType.month:
            return currentScheduleDate.plus({ months: 1 });
        case TimeType.week:
            return currentScheduleDate.plus({ week: 1 });
        case TimeType.day:
            return currentScheduleDate.plus({ days: 1 });
        case TimeType.hour:
            return currentScheduleDate.plus({ hours: 1 });
        case TimeType.minute:
            return currentScheduleDate.plus({ minutes: 1 });
        case TimeType.second:
            return currentScheduleDate.plus({ seconds: 1 });
        case TimeType.none:
        case TimeType.custom:
            console.error(`getNextScheduleDate: '${timeType}' is not a valid TimeType for scheduling.`);
            return DateTime.invalid(`'${timeType}' is not a valid TimeType for scheduling.`);
        default:
            console.error(`getNextScheduleDate: Unsupported TimeType: ${timeType}`);
            return DateTime.invalid(`Unsupported TimeType: ${timeType}`);
    }
}

/**
 * Sends messages on a time interval of variable length for the given repeated reminder
 * @param {Function} client Discord client instance
 * @param {Reminder} reminder Scheduled Reminder
 */
async function scheduleReminderInterval(client: Discord.Client, reminder: Reminder) {
    if(reminder.repeat === TimeType.none) {
        console.error(`Reminder interval scheduler was called, but given reminder #${reminder.id} is not set to repeat.`);
        return;
    }

    if(reminder.repeat === TimeType.custom) {
        console.error(`Reminder interval scheduler was called, but given reminder #${reminder.id} runs on a fixed time length schedule.`);  // TODO include these into the scheduler maybe?
        return;
    }

    const nextTimeoutDate = getNextScheduleDate(reminder.repeat, DateTime.fromJSDate(reminder.time));
    const now = DateTime.now();
    console.debug("Scheduling next timeout");
    // set next timer
    reminder.timer?.cancel();
    reminder.timer = new LongTimer(
        async () => {
            sendReminderMessage(await client.users.fetch(reminder.userId), await client.channels.fetch(reminder.channelId) as Discord.TextBasedChannel, reminder);
            scheduleReminderInterval(client, reminder);
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
            )
            .addBooleanOption(option => option
                .setName('private')
                .setDescription('Send reminder in a private message?')
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
            )
            .addBooleanOption(option => option
                .setName('private')
                .setDescription('Send reminder in a private message?')
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
     * @param {Discord.ChatInputCommandInteraction} interaction Discord interaction that called this command
     */
    async execute(interaction: Discord.ChatInputCommandInteraction) {
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
            const isPrivate = interaction.options.getBoolean('private') ?? false;   // default is false

            let futureTime : DateTime;
            if (cmd === 'at') {
                // set zone if given, then set timestamp
                futureTime = (timezone ? now.setZone(timezone) : now)
                    .set({year: year, month: month, day: day, hour: hour, minute: minute, second: second});
            } else if (cmd === 'in') {
                // add given time to current time
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

            if(!futureTime.isValid) {
                if(futureTime.invalidReason === "unsupported zone")
                    interaction.editReply(`Invalid timezone. Just supplying the timezone abbreviation by itself may not always work, so please use the timezones supplied by the autocomplete list or enter it directly as a UTC time offset. (e.g. \`UTC+09\`)`);
                else
                    interaction.editReply(`Invalid date. ${futureTime.invalidReason}: ${futureTime.invalidExplanation}`);
                return;
            }

            // calculate milliseconds till reminder date
            const msToFutureTime = futureTime.toMillis() - now.toMillis();

            // send rejection message if reminder date lies in the past
            if (msToFutureTime < 0) {
                interaction.editReply(`Sorry, I can't notify you in the past.\n...\n...or can I?`);
                return;
            }

            const reminder = await createReminder(
                interaction.user.id,
                interaction.channel?.id,
                repeatTimeType,
                futureTime,
                text,
                isPrivate
            );

            // build confirmation message depending on reminder type
            const futureDateString: string = `${futureTime.toLocaleString(DateTime.DATETIME_SHORT_WITH_SECONDS)} (${futureTime.zoneName})`;
            const confirmationMsgCancelInstruction = `You can cancel this reminder by using: \`/remindme cancel ${reminder.id}\``
            let confirmationMsg: string = "Alright! I'll notify you" + (isPrivate ? " in a direct message" : "") + ` on **${futureDateString}**`;

            if(!repeatTimeType) {
                // single time reminder
                confirmationMsg += `.`;
            } else if (repeatTimeType === TimeType.custom) {
                // repeating reminder on a fixed time length
                confirmationMsg += ` and will then continue doing so every **${Math.round(msToFutureTime/1000)} seconds**.`;
            } else {
                // repeating reminder on a fixed timestamp
                confirmationMsg += ` and will then continue doing so every **${TimeType[reminder.repeat]}**.`;
            }
            confirmationMsg += `\n${confirmationMsgCancelInstruction}`;

            // if reminder is set to private, try to DM the confirmation message. If that fails, the confirmation message will be sent publicly with a note to allow DMs
            if(!isPrivate)
                interaction.editReply(confirmationMsg);
            else {
                const msg = await DiscordUtils.sendDirectMessage(interaction.client, interaction.user.id, confirmationMsg);
                if(!msg)
                    interaction.editReply(confirmationMsg + "\n\n**Warning: It appears I can't send you direct messages!** Make sure to allow messages from server members in your Discord settings, so I can message you!");
                else
                    interaction.deleteReply();
            }

            // create timer and add timer to timer collection
            let timer : LongTimer;
            if(repeatTimeType == 9) {  // 9 == run every msToFutureTime milliseconds on repeat
                timer = new LongTimer(
                    () => sendReminderMessage(interaction.user, interaction.channel, reminder),
                    msToFutureTime,
                    repeatTimeType > 0
                );
            } else if(cmd === 'at' && repeatTimeType) { // run every repeatType on repeat
                timer = new LongTimer(
                    () => {
                        sendReminderMessage(interaction.user, interaction.channel, reminder);   // TODO just call the interval - why am I still creating a timer by hand for this case?
                        scheduleReminderInterval(interaction.client, reminder);
                    },
                    msToFutureTime,
                    repeatTimeType > 0
                );
            } else {
                timer = new LongTimer(
                    () => {
                        sendReminderMessage(interaction.user, interaction.channel, reminder);
                        cancelReminder(reminder.id, interaction.user);
                    },
                    msToFutureTime,
                    repeatTimeType != null
                );
            }
            // start timer and add it to reminder
            timer.start();
            reminder.timer = timer;
            // add reminder to active reminders
            ActiveReminders.set(reminder.id, reminder);
            //reminder.save();  // timer is a virtual attribute - no need to update database if nothing else was changed since creation
        }
    },
    /**
     * Used to respond to autocomplete interactions. Responds with an array of named timezones (partially) matching the users input
     * @param {Discord.AutocompleteInteraction} interaction Discord interaction that requested this autocomplete response
     */
    async autocomplete(interaction: Discord.AutocompleteInteraction) {
        const focusedValue = interaction.options.getFocused();

		const filtered = NamedTimeZones.filter(ntz => ntz.shortName.toLowerCase().startsWith(focusedValue.toLowerCase()));
		await interaction.respond(
			filtered.slice(0,25).map(ntz => ({ name: `${ntz.shortName}: ${ntz.fullName} (${ntz.UTCOffset})`, value: ntz.UTCOffset })),
        );
    }
};
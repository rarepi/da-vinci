import Discord from "discord.js"
import { SlashCommandBuilder } from '@discordjs/builders';
import { DateTime } from 'luxon';
import databaseModels from '../db';
import { Reminder, TimerType } from "../models/reminders";

const ReminderModel = databaseModels.Reminder;

async function createReminder(userId: string, channelId: string | undefined, repeat: TimeType | boolean, time: DateTime, text: string | null) : Promise<Reminder> {
    return await ReminderModel.create({
        userId: userId,
        channelId: channelId,
        repeat: repeat,
        time: time,
        text: text
    });
}

enum TimeType {
    year = 1,
    month = 2,
    week = 3,
    day = 4,
    hour = 5,
    minute = 6,
    second = 7,
    millisecond = 8
}

// TODO: check if virtual fields stay alive even if reminder is refetched from db. If they surprisingly do, this map is not needed.
const ActiveReminders = new Map<number, Reminder>();

async function startupReminders(client: Discord.Client) {
    const now = DateTime.now();
    const Reminders : Reminder[] = await ReminderModel.findAll();

    console.info(`Initiating ${Reminders.length} reminders...`)
    for(const reminder of Reminders) {
        let futureTime = DateTime.fromJSDate(reminder.time);
        const user = await client.users.fetch(reminder.userId);
        const channel = await client.channels.fetch(reminder.channelId) as Discord.TextBasedChannel;

        if(reminder.repeat === 0){
            const msToFutureTime = futureTime.toMillis() - now.toMillis();
            if(msToFutureTime <= 0) {
                // notification is late
                reminder.text = reminder.text.concat(`\n\nNote: This reminder was originally scheduled for ${futureTime.toLocaleString(DateTime.DATETIME_SHORT_WITH_SECONDS)} but I was unavailable at the time. Sorry!`)
                notifyUser(user, channel, reminder);
                cancelReminder(reminder.id, user);
            } else {
                // schedule reminder once
                const timeout = setTimeout(
                    async () => notifyUser(user, channel, reminder),
                    msToFutureTime
                );
                reminder.timer = timeout;
                reminder.timerType = TimerType.TIMEOUT;
                ActiveReminders.set(reminder.id, reminder);
            }

        } else if(reminder.repeat > 0) {
            // find next future notification date
            while(futureTime.toMillis() < now.toMillis()) {
                futureTime = getNextTimeoutDateIteration(reminder.repeat, futureTime);
            }
            // ms between startup time and next timeout
            const msToFutureTime = futureTime.toMillis() - now.toMillis();
            console.debug(`Resuming reminder #${reminder.id} in ${msToFutureTime/1000} seconds.`)
            // TODO resumption of interval is currently not supported by stored data model
            if(reminder.timerType === TimerType.INTERVAL) {
                reminder.destroy();
                console.info(`Reminder #${reminder.id} has been purged due to missing implementation.`);
            } else if (reminder.timerType === TimerType.TIMEOUT) {
                // schedule repeated reminder in relation to first date
                const timeout = setTimeout(
                    () => setNextReminderTimeout(
                        () => notifyUser(user, channel, reminder), reminder, reminder.repeat
                    ),
                    msToFutureTime
                );
                reminder.timer = timeout;
                reminder.timerType = TimerType.TIMEOUT;
                ActiveReminders.set(reminder.id, reminder);
            }
        }
    }
}

async function cancelReminder(id: number, user: Discord.User) : Promise<boolean> {
    const reminder = await Reminder.findByPk(id);
    if(!reminder || reminder.userId !== user.id)
        return false;

    // clear timer
    if(reminder.timerType === TimerType.INTERVAL)
        clearInterval(reminder.timer);
    else
        clearTimeout(reminder.timer);
        
    // delete from map
    ActiveReminders.delete(id);
    // delete from database
    await reminder.destroy();

    return true;

}

async function notifyUser(user: Discord.User, channel: Discord.TextBasedChannel | null, reminder: Reminder) {
    let text = reminder.text ?? `This is your scheduled notification.\nThere was no message provided.`;
    if(reminder.repeat > 0)
        text = text.concat(`\n\nTo cancel this repeatedly scheduled reminder, use \`/remindme cancel ${reminder.id}\``)
        
    if(channel)
        await channel.send(`${user.toString()} ${text}`);
    else
        ; // TODO
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
    console.debug("Executing scheduled timeout");
    callback();
    console.debug("Scheduling next timeout");
    // set next timer
    let timeout = setTimeout(() => setNextReminderTimeout(callback, reminder, timeType), nextTimeoutDate.toMillis() - now.toMillis());
    // replace old timeout data
    reminder.time = nextTimeoutDate.toJSDate();
    reminder.timer = timeout;
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
            .addIntegerOption(option => option
                .setName('repeat')
                .setDescription('When should I repeat this reminder afterwards?')
                .setRequired(true)
                .addChoices(
                    {name: 'never', value: 0},
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
                .setRequired(true)
                .addChoices(
                    {name: 'no', value: 0},
                    {name: 'yes', value: 1}
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
            const repeatTimeType: boolean | TimeType = interaction.options.getInteger('repeat', true);   // TimeType index if cmd "in", or 0|1 if cmd "at"
            const text = interaction.options.getString('text');
            let futureTime : DateTime;
            if (cmd === 'at') {
                futureTime = now.set({
                    year: year,
                    month: month,
                    day: day,
                    hour: hour,
                    minute: minute,
                    second: second
                })
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
            if(msToFutureTime > 0) {
                interaction.editReply(`Alright! I'll notify you on ${futureTime.toLocaleString(DateTime.DATETIME_SHORT_WITH_SECONDS)}. You can cancel this by using \`/remindme cancel ${reminder.id}\``)
            } else {
                interaction.editReply(`Sorry, I can't notify you in the past.\n...\n...or can I?`)
                return;
            }

            // create timer and add timer to timer collection
            if(cmd === 'in' && repeatTimeType == 1) {  // 1 = run every msToFutureTime milliseconds
                const timeout = setInterval(() => notifyUser(interaction.user, interaction.channel, reminder), msToFutureTime)
                reminder.timer = timeout;
                reminder.timerType = TimerType.INTERVAL;
                reminder.save();
                ActiveReminders.set(reminder.id, reminder);
            } else if(cmd === 'at' && repeatTimeType > 0) {
                const timeout = setTimeout(() => setNextReminderTimeout(() => notifyUser(interaction.user, interaction.channel, reminder), reminder, repeatTimeType), msToFutureTime);
                reminder.timer = timeout;
                reminder.timerType = TimerType.TIMEOUT;
                reminder.save();
                ActiveReminders.set(reminder.id, reminder);
            } else {
                const timeout = setTimeout(() => notifyUser(interaction.user, interaction.channel, reminder), msToFutureTime);
                reminder.timer = timeout;
                reminder.timerType = TimerType.TIMEOUT;
                reminder.save();
                ActiveReminders.set(reminder.id, reminder);
            }
        }
    },
};
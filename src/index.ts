import fs from 'fs';
import Discord from "discord.js";
import { setupRedditVideoDownloader } from './commands/passive/redditvideo';
import { setupSteamURLConverter } from './commands/passive/steamurl';
import { sync as synchronizeDatabaseModels } from './db';
import { setupCLI } from './commandline';
import { ClientWithCommands, Command } from './commandType';
import { token } from '../config.json';

const OWNER_ID = "268469541841928193";
const USER_LOCALE = Intl.DateTimeFormat().resolvedOptions().locale;
const USER_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

// enable debug outputs only if "-debug" parameter is given
const CONSOLE_DEBUG = process.argv.includes("-debug");
if (!CONSOLE_DEBUG)
    console.debug = function () { }

console.debug(`Debug outputs enabled.`)
console.debug(`Detected locale: ${USER_LOCALE}; Detected timezone: ${USER_TIMEZONE}`);

/*
    setup Discord client
*/
const client = new ClientWithCommands({
    intents: [
        Discord.GatewayIntentBits.Guilds,
        Discord.GatewayIntentBits.GuildMessages,
        Discord.GatewayIntentBits.DirectMessages,
        Discord.GatewayIntentBits.MessageContent,
    ],
    partials: [
        Discord.Partials.Channel
    ]
});

// read command files
async function readCommandFiles() {
    const commandFiles = fs.readdirSync('src/commands').filter((file: string) => file.endsWith('.ts'));

    for (const file of commandFiles) {
        const command: Command = await import(`./commands/${file}`) as unknown as Command; // use Command interface to assume the existence of its properties
        if (command.prepare != undefined) {  // allows the call of an async function inside a command file
            await command.prepare();
        }
        const data: Discord.SlashCommandBuilder = command.data;
        // command name : exported module
        client.commands.set(data.name, command);
    }
}

function parseDiscordCommandInteractionOption(options: readonly Discord.CommandInteractionOption[]) : string[] {
    let cmd: string[] = [];
    for(let i=0; i < options.length; i++) {
        const option = options[i];
        if (option.type == Discord.ApplicationCommandOptionType.SubcommandGroup || option.type == Discord.ApplicationCommandOptionType.Subcommand)
            cmd.push(option.name);
        else if (option.name && option.value != undefined)  // parameter CommandInteractionOption.value is optional
            cmd.push(`${option.name}:${option.value.toString()}`);
        
        // recursively add all command line options
        if(option.options && option.options?.length > 0)
            cmd.push(...parseDiscordCommandInteractionOption(option.options));
    }
    return cmd;
}

function setupChatLog() {
    // print every text message to console
    client.on('messageCreate', message => {
        let logMessage : string= "";
        if(message.channel.isDMBased() && message.channel.isTextBased()) {
            logMessage = logMessage.concat(
                `DIRECT MESSAGE @ ${message.createdAt.toLocaleString(USER_LOCALE, { timeZone: USER_TIMEZONE })}`,
                ` BY ${message.author.username}#${message.author.discriminator} {${message.author.id}}:`);
            if(message.author.id != OWNER_ID && message.author.id != client.user?.id)
                // also send direct messages to bot owner
                client.users.createDM(OWNER_ID).then(dm => {
                    dm.send(`\`\`\`${logMessage}\`\`\``).catch((error:any) => console.error(`[${error.code}] ${error.message}`));
                });
        } else if(message.inGuild() && message.channel.isTextBased()) {
            logMessage = logMessage.concat(
                `MESSAGE @ ${message.createdAt.toLocaleString(USER_LOCALE, { timeZone: USER_TIMEZONE })}`,
                ` IN ${message.guild?.name}#${(message.channel as Discord.TextChannel).name}] {${message.guild.id}#${message.channel.id}}`,
                ` BY ${message.author.username}#${message.author.discriminator} {${message.author.id}}:`);
        }

        if(message.content.length > 0)
            logMessage = logMessage.concat(`\n message: "${message.content}"`);
        if(message.attachments.size > 0)
            logMessage = logMessage.concat(`\n attachments: ${message.attachments.map((attachment => { return attachment.url })).join(", ")}`);
        if(message.embeds.length > 0)
            logMessage = logMessage.concat(`\n embed count: ${message.embeds.length}`);
        if(message.flags.has("Ephemeral")) {
            logMessage = logMessage.concat(`\n ephemeral`);
            if(message.interaction?.user)
                logMessage = logMessage.concat(`: ${message.interaction.user.username}#${message.interaction.user.discriminator}`);
        }
        console.log(logMessage);
    });

    // print every interaction to console
    client.on('interactionCreate', interaction => {
        if (interaction.type !== Discord.InteractionType.ApplicationCommand) return;
        let timestamp = interaction.createdAt;
        let channelName = (interaction.channel as Discord.TextChannel).name;
        let username = `${interaction.user.username}#${interaction.user.discriminator}`;
        let cmd: string[] = [interaction.commandName];

        // rebuild used commandline via option properties
        let options = interaction.options.data;
        cmd.push(...parseDiscordCommandInteractionOption(options));

        let commandLine = cmd.join(` `);
        console.log(`APP_CMD [${timestamp} ${channelName}] ${username} : /${commandLine}`);
    });
}

function setupCommandListeners() {
    // execute commands on interaction
    client.on('interactionCreate', async interaction => {
        if (interaction.type !== Discord.InteractionType.ApplicationCommand) return;

        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            //await interaction.reply({ content: 'There was an error while executing this command.', ephemeral: true });
        }
    });

    // respond to autocomplete requests
    client.on('interactionCreate', async interaction => {
        if (!interaction.isAutocomplete()) return;
        
        const command = client.commands.get(interaction.commandName);
        if (!command || !command.autocomplete) return;
        try {
            await command.autocomplete(interaction);
        } catch (error) {
            console.error(error);
        }
    });
}

function setupPassiveFunctions() {
    setupRedditVideoDownloader(client);
    setupSteamURLConverter(client);
}

async function initiateReminders() {
    const remindme = await import(`./commands/remindme`) as any;    // TODO this is an ugly workaround to import reminder startup function alongside command data
    remindme.startupReminders(client as Discord.Client);
}

function login() {
    // runs once after login
    client.once('ready', () => {
        setupCLI(client);

        client.user?.setPresence({
            status: 'online',
            activities: [{
                name: "you",
                type: Discord.ActivityType.Watching
            }]
        });
        console.info("Ready!");
    });

    return client.login(token);
}

// execute various startup procedures
synchronizeDatabaseModels()
.then(() => readCommandFiles())
.then(() => setupChatLog())
.then(() => setupCommandListeners())
.then(() => setupPassiveFunctions())
.then(() => login())
.then(() => initiateReminders())
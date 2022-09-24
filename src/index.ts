import fs from 'fs';
import Discord from "discord.js"
import * as redditvideo from './commands/passive/redditvideo';
import * as steamurl from './commands/passive/steamurl';
import db, { sync as synchronizeDatabaseModels } from './db'
import CLI from './commandline'
import { ClientWithCommands, Command } from './commandType'
import { token } from './config.json';

const OWNER_ID = "268469541841928193";
const USER_LOCALE = Intl.DateTimeFormat().resolvedOptions().locale;
const USER_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

const RGX_REDDIT_URL = /^[^\r\n]*(https?:\/\/(?:www\.)?reddit\.com\/r\/\w+?\/(?:comments\/)?\w+\/?)[^\r\n]*$/gm
const RGX_STEAM_URL = /^(?:[^\r\n]+ )*<?((?:https?:\/\/)?(?:\w+\.)*steam(?:powered|community).com\/?\S*?)>?(?: [^\r\n]+)*$/gm

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



// chat log: print every text message to console
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

// chat log: print every interaction to console
client.on('interactionCreate', interaction => {
    if (interaction.type !== Discord.InteractionType.ApplicationCommand) return;
    let timestamp = interaction.createdAt;
    let channelName = (interaction.channel as Discord.TextChannel).name;
    let username = `${interaction.user.username}#${interaction.user.discriminator}`;
    let cmd: string[] = [interaction.commandName];
    // rebuild used commandline via option properties
    let options: Discord.CommandInteractionOption<Discord.CacheType> | undefined = interaction.options.data[0];
    while (options) {
        if (options.type == Discord.ApplicationCommandOptionType.SubcommandGroup || options.type == Discord.ApplicationCommandOptionType.Subcommand)
            cmd.push(options.name);
        else if (options.value)  // parameter CommandInteractionOption.value is optional
            cmd.push(options.value.toString());
        options = options.options?.[0];
    }
    let commandLine = cmd.join(` `);
    console.log(`APP_CMD [${timestamp} ${channelName}] ${username} : /${commandLine}`);
});

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

/*
    setup passive functions
*/

// reddit video uploader
client.on('messageCreate', message => {
    if (message.author.bot) return; // ignore bot messages, including my own
    const match = RGX_REDDIT_URL.exec(message.content);
    if (match) {
        let reddit_url = match[1];
        console.debug(`Reddit link detected: ${reddit_url}`);
        redditvideo.execute(message, reddit_url);
    } else return;
});

// posts URLs of steam websites as "steam://"" URLs for easy access via steam client
client.on('messageCreate', message => {
    if (message.author.id === client.user?.id) return;  // ignore my own messages
    const match = RGX_STEAM_URL.exec(message.content);
    if (match) {
        let steam_url = match[1];
        console.debug(`Steam link detected: ${steam_url}`);
        steamurl.execute(message, steam_url);
    } else return;
});

// runs once after login
client.once('ready', () => {
    // setup command line interface
    const stdin = process.openStdin();
    const cli = new CLI(client);

    stdin.addListener("data", function(d) {
        const input : string[] = d.toString().trim().split(' ');
        const command : string = input[0];
        const args = input.splice(1);
        if(cli.callables.hasOwnProperty(command)) {
            cli.callables[command](...args);
        }
    });

    console.info('Ready!');
});

// execute various startup procedures
synchronizeDatabaseModels()
.then(() => readCommandFiles())
.then(() => client.login(token))
.then(async() => {
    const remindme = await import(`./commands/remindme`) as any;    // TODO this is an ugly workaround to import reminder startup function alongside command data
    remindme.startupReminders(client as Discord.Client);
})
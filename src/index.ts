import fs from 'fs';
import Discord from "discord.js"
import * as redditvideo from './commands/passive/redditvideo';
import * as steamurl from './commands/passive/steamurl';
import { SlashCommandBuilder } from '@discordjs/builders';
import { Routes } from "discord-api-types/v10";
import { REST } from '@discordjs/rest';
import { clientId, guildId, token } from './config.json';
import db from './db'
//const {command_prefix: COMMAND_PREFIX} = require('../config.json');


/*
    setup Discord client
*/
const client = new Discord.Client({
    intents: [
        Discord.GatewayIntentBits.Guilds,
        Discord.GatewayIntentBits.GuildMessages,
        Discord.GatewayIntentBits.DirectMessages,
    ]
});

// runs once after login
client.once('ready', () => {
    console.log('Ready!');
});

// chat log: print every text message to console
client.on('messageCreate', message => {
    console.log(`MSG [${message.createdAt} ${(message.channel as Discord.TextChannel).name}] ${message.author.username}#${message.author.discriminator} : ${message.content}`);
});

// chat log: print every interaction to console
client.on('interactionCreate', interaction => {
    if (interaction.type !== Discord.InteractionType.ApplicationCommand) return;
    let timestamp = interaction.createdAt;
    let channelName = (interaction.channel as Discord.TextChannel).name;
    let username = `${interaction.user.username}#${interaction.user.discriminator}`;
    let cmd : string[] = [interaction.commandName];
    // rebuild used commandline via option properties
    let options : Discord.CommandInteractionOption<Discord.CacheType> | undefined = interaction.options.data[0];
    while(options) {
        if(options.type == Discord.ApplicationCommandOptionType.SubcommandGroup || options.type == Discord.ApplicationCommandOptionType.Subcommand)
            cmd.push(options.name);
        else if(options.value)  // parameter CommandInteractionOption.value is optional
            cmd.push(options.value.toString());
        options = options.options?.[0];
    }
    let commandLine = cmd.join(` `);
    console.log(`APP_CMD [${timestamp} ${channelName}] ${username} : /${commandLine}`);
});



/*
    setup slash commands
*/
interface Command {
    data: SlashCommandBuilder,
    execute: Function
}

// read command files
let commands = new Discord.Collection<string, Command>();
async function collectCommands() {
    const commandFiles = fs.readdirSync('src/commands').filter((file: string) => file.endsWith('.ts'));

    for (const file of commandFiles) {
        const command:Command = await import(`./commands/${file}`) as unknown as Command; // use Command interface to assume the existence of its properties
        const data:SlashCommandBuilder = command.data;
        // command name : exported module
        commands.set(data.name, command);
    }
}

// register commands to Discord
collectCommands()
    .then(() => registerCommands()); // should not be executed everytime - TODO: either check if new commands have been added or just make this a command by itself
function registerCommands() {
    const commands_json: any[] = []

    for (const cmd of commands) {
        commands_json.push(cmd[1].data.toJSON());
        console.log(`Added ${cmd[0]} to command register.`)
    }

    const rest = new REST({ version: '10' }).setToken(token);

    rest.put(Routes.applicationCommands(clientId), { body: commands_json })
        .then(() => console.log('Successfully registered application commands.'))
        .catch(console.error);
}

// execute commands on interaction
client.on('interactionCreate', async (interaction) => {
	if (interaction.type !== Discord.InteractionType.ApplicationCommand) return;

	const command = commands.get(interaction.commandName);
	if (!command) return;
	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(error);
		//await interaction.reply({ content: 'There was an error while executing this command.', ephemeral: true });
	}
});



/*
    setup passive functions
*/

// reddit video uploader
client.on('messageCreate', message => {
    const REDDIT_URL_RGX = /^[^\r\n]*(https?:\/\/(?:www\.)?reddit\.com\/r\/\w+?\/(?:comments\/)?\w+\/?)[^\r\n]*$/gm
    if (message.author.bot) return;
    const match = REDDIT_URL_RGX.exec(message.content);
    if(match) {
        let reddit_url = match[1];
        console.log(`Reddit link detected: ${reddit_url}`);
        redditvideo.execute(message, reddit_url);
    } else return;
});

// posts URLs of steam websites as "steam://"" URLs for easy access via steam client
client.on('messageCreate', message => {
    if (message.author.id === client.user?.id) return;
    const STEAM_URL_RGX = /^(?:[^\r\n]+ )*<?((?:https?:\/\/)?(?:\w+\.)*steam(?:powered|community).com\/?\S*?)>?(?: [^\r\n]+)*$/gm
    const match = STEAM_URL_RGX.exec(message.content);
    if(match) {
        let steam_url = match[1];
        console.log(`Steam link detected: ${steam_url}`);
        steamurl.execute(message, steam_url);
    } else return;
});

/*
    setup database
*/
console.log(db)

client.login(token);
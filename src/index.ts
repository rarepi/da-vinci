import fs from 'fs';
import Discord from "discord.js"
import * as redditvideo from './commands/passive/redditvideo';
import * as steamurl from './commands/passive/steamurl';
import { SlashCommandBuilder } from '@discordjs/builders';
import { Routes } from "discord-api-types/v10";
import { REST } from '@discordjs/rest';
import { clientId, guildId, token } from './config.json';
//const {command_prefix: COMMAND_PREFIX} = require('../config.json');

const intents = new Discord.Intents();
intents.add(
    Discord.Intents.FLAGS.GUILDS,
    Discord.Intents.FLAGS.GUILD_MESSAGES, 
    Discord.Intents.FLAGS.GUILD_MESSAGE_REACTIONS, 
    Discord.Intents.FLAGS.DIRECT_MESSAGES, 
    Discord.Intents.FLAGS.DIRECT_MESSAGE_REACTIONS);

const client = new Discord.Client({ 
    intents: intents
});

// runs once after login
client.once('ready', () => {
    console.log('Ready!');
});

// chat log: print every text message to console
client.on('messageCreate', message => {
    console.log(`[${message.createdAt} ${(message.channel as Discord.TextChannel).name}] ${message.author.username}#${message.author.discriminator} : ${message.content}`);
});

/*
    slash commands
*/
interface Command {
    data: SlashCommandBuilder,
    execute: Function
}

let commands = new Discord.Collection<string, Command>();
async function collectCommands() {
    const commandFiles = fs.readdirSync('src/commands').filter((file: string) => file.endsWith('.ts'));

    for (const file of commandFiles) {
        const command:Command = await import(`./commands/${file}`) as unknown as Command; // use Command interface to assume the existence of its properties
        console.log(command);
        const data:SlashCommandBuilder = command.data;
        console.log(command.data.name);
        // command name : exported module
        commands.set(data.name, command);
    }
}

// dynamic command register
collectCommands()
    .then(() => registerCommands()); // should not be executed everytime - TODO: either check if new commands have been added or just make this a command by itself
function registerCommands() {
    const commands_json: any[] = []

    for (const cmd of commands) {
        commands_json.push(cmd[1].data.toJSON());
    }

    console.log("json:\n", commands_json);

    const rest = new REST({ version: '10' }).setToken(token);

    rest.put(Routes.applicationCommands(clientId), { body: commands_json })
        .then(() => console.log('Successfully registered application commands.'))
        .catch(console.error);
}

// execute command on interaction
client.on('interactionCreate', async (interaction) => {
	if (!interaction.isApplicationCommand()) return;

	const command = commands.get(interaction.commandName);
	if (!command) return;
	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(error);
		await interaction.reply({ content: 'There was an error while executing this command.', ephemeral: true });
	}
});

/*
    passive functions
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

client.login(token);
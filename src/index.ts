import fs from 'fs';
import Discord from "discord.js"
import * as redditvideo from './commands/passive/redditvideo';
import * as steamurl from './commands/passive/steamurl';
const {command_prefix: COMMAND_PREFIX} = require('../config.json');

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
 
let commands = new Discord.Collection<string, any>();

const commandFiles = fs.readdirSync('src/commands').filter((file: string) => file.endsWith('.ts'));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    // command name : exported module
    commands.set(command.name, command);
}

// runs once after login
client.once('ready', () => {
    console.log('Ready!');
});

// chat log
client.on('message', message => {
    console.log(`[${message.createdAt} ${(message.channel as Discord.TextChannel).name}] ${message.author.username}#${message.author.discriminator} : ${message.content}`);
});

// commands
client.on('message', message => {
    if (!message.content.startsWith(`${COMMAND_PREFIX}`) || message.author.bot) return;

    const args = message.content.substring(COMMAND_PREFIX.length).trim().split(/ +/);
    const command:string = args.shift()!.toLowerCase();

    if (!commands.has(command)) return;
    try {
        commands.get(command).execute(message, args);
    } catch (error) {
        console.error(error);
        message.reply('Oops, that didn\'t work!');
    }
});

// reddit video uploader
client.on('message', message => {
    const REDDIT_URL_RGX = /^[^\r\n]*(https?:\/\/(?:www\.)?reddit\.com\/r\/\w+?\/(?:comments\/)?\w+\/?)[^\r\n]*$/gm
    if (message.author.bot) return;
    const match = REDDIT_URL_RGX.exec(message.content);
    if(match) {
        let reddit_url = match[1];
        console.log(`Reddit link detected: ${reddit_url}`);
        redditvideo.execute(message, reddit_url);
    } else return;
});

// posts URLs of steam websites as "steam://"" URLs for easy access
client.on('message', message => {
    const STEAM_URL_RGX = /^(?:[^\r\n]+ )*<?((?:https?:\/\/)?(?:\w+\.)*steam(?:powered|community).com\/?\S*?)>?(?: [^\r\n]+)*$/gm
    if (message.author.id === client.user?.id) return;
    const match = STEAM_URL_RGX.exec(message.content);
    if(match) {
        let steam_url = match[1];
        console.log(`Steam link detected: ${steam_url}`);
        steamurl.execute(message, steam_url);
    } else return;
});

client.login(process.env.TOKEN_DAVINCI);
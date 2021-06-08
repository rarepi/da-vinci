const fs = require('fs');
const Discord = require('discord.js');
const redditvideo = require('./commands/passive/redditvideo.js');
const {command_prefix: COMMAND_PREFIX} = require('./config.json');

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
 
client.commands = new Discord.Collection();

const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    // command name : exported module
    client.commands.set(command.name, command);
}

// runs once after login
client.once('ready', () => {
    console.log('Ready!');
});

// chat log
client.on('message', message => {
    console.log(`[${message.createdAt} ${message.channel.name}] ${message.author.username}#${message.author.discriminator} : ${message.content}`);
});

// commands
client.on('message', message => {
    console.log("huh")
    if (!message.content.startsWith(`${COMMAND_PREFIX}`) || message.author.bot) return;
    console.log("huh2")

    const args = message.content.substring(COMMAND_PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (!client.commands.has(command)) return;
    try {
        client.commands.get(command).execute(message, args);
    } catch (error) {
        console.error(error);
        message.reply('Oops, that didn\'t work!');
    }
});


// https://www.reddit.com/r/gtaonline/comments/nm6x3z/i_jumped_in_between_two_helicopters/
// get https://www.reddit.com/r/gtaonline/comments/nm6x3z/i_jumped_in_between_two_helicopters/.json
// grab fallback_url from json => https://v.redd.it/wh56h6s8vn171/DASH_480.mp4
// grab audio by replacing resolution with "audio" => https://v.redd.it/wh56h6s8vn171/DASH_audio.mp4
// mux together
// upload

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

client.login(process.env.TOKEN_DAVINCI);
import Discord from "discord.js"

/**
 * Defines the structure of a slash command object
 */
export interface Command {
    /** A function to be called before 'data' is added to the client */
    prepare?: () => Promise<void>,
    /** A SlashCommandBuilder defining the full structure of the command */
    data: Discord.SlashCommandBuilder,
    /** A function to be executed when the slash command is called */
    execute: (interaction: Discord.ChatInputCommandInteraction) => Promise<void>,
    /** A function to be executed when the slash command requests autocompletion */
    autocomplete?: (interaction: Discord.AutocompleteInteraction) => Promise<void>
}

/**
 * Extends the default Discord.Client class by a collection of slash commands
 */
export class ClientWithCommands extends Discord.Client {
    commands : Discord.Collection<string, Command>

    constructor(options: Discord.ClientOptions) {
        super(options)
        this.commands = new Discord.Collection<string, Command>();
    }
}

/**
 * Sends a message to the channel of the given id
 * @param {Discord.Client} client Discord client instance
 * @param {string} channelId Id of the channel the message will be sent to
 * @param {string} message Text content of the message that will be sent
 * @returns {Promise<Discord.Message<true> | undefined>} The sent message
 */
export async function sendChannelMessage(client: Discord.Client, channelId: string, ...message: string[]) : Promise<Discord.Message<true> | undefined> {
    return await client.channels.fetch(channelId)
        .then(channel => {
            if(channel?.isTextBased() && !channel.isDMBased()) {
                return channel.send(message.join(' '))
                    .catch((error:any) => {
                        console.error(`[${error.code}] ${error.message}`);
                        return undefined;
                    });
            }
        }).catch((error:any) => {
            if(error.code == 10003) {
                console.error(`Channel not found.`)
            } else console.error(`[${error.code}] ${error.message}`)
            return undefined;
        });
}

/**
 * Sends a message to the user of the given id
 * @param {Discord.Client} client Discord client instance
 * @param {string} userId Id of the user the message will be sent to
 * @param {string} message Text content of the message that will be sent
 * @returns {Promise<Discord.Message<true> | undefined>} The sent message
 */
export async function sendDirectMessage(client: Discord.Client, userId: string, ...message: string[]) : Promise<Discord.Message<false> | undefined>{
    return await client.users.createDM(userId)
        .then(dm => {
            return dm.send(message.join(' '))
                .catch((error:any) => {
                    console.error(`[${error.code}] ${error.message}`);
                    return undefined;
                });
        }).catch((error:any) => {
            if(error.code == 50033) {
                console.error(`Invalid user.`)
            } else console.error(`[${error.code}] ${error.message}`)
            return undefined;
        });
}
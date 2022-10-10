import Discord from "discord.js"
import { clientId, token } from '../config.json';
import * as DiscordUtils from './DiscordUtils'

/** Map storing commands by aliases */
type FunctionMap = {
    [name:string]: (...args:any) => void
};

/**
 * Opens a listener to the stdin and executes any known command inputs
 * @param {DiscordClientWithCommands} client Discord client instance
 */
export function setup(client: DiscordUtils.ClientWithCommands) {
    const stdin = process.openStdin();
    const cli = new CLI(client);

    stdin.addListener("data", function(data) {
        const input : string[] = data.toString().trim().split(' ');
        const command : string = input[0];
        const args = input.splice(1);
        if(cli.callables.hasOwnProperty(command)) {
            cli.callables[command](...args);
        } else {
            console.error(`Unknown command: ${command}`);
        }
    });
}

/**
 * Defines various commands callable from CLI and provides a map of aliases to call them by name
 */
class CLI {
    client: DiscordUtils.ClientWithCommands;
    /**
     * @param client Discord client instance
     */
    constructor(client: DiscordUtils.ClientWithCommands) {
        this.client = client;
    }

    /**
     * Sets status to "do not disturb" and terminates the process.
     * @param {number} code Exit code to use when terminating
     */
    private exit = (code?: number | undefined) => {
        this.client.user?.setStatus('dnd');
        code = Number(code);
        console.info(`Shutting down...`);
        process.exit(code);
    }

    /**
     * Sends a Discord message to the channel of provided id
     * @param {string} channelId Id of a text based Discord channel
     * @param {string} message The text message to be sent
     */
    private say = async (channelId: string, ...message: string[]) => {
        await DiscordUtils.sendChannelMessage(this.client, channelId, ...message);
    }

    /**
     * Sends a Discord message to the user of provided id
     * @param {string} userId Id of a Discord user
     * @param {string} message The text message to be sent
     */
    private dm = async (userId: string, ...message: string[]) => {
        await DiscordUtils.sendDirectMessage(this.client, userId, ...message);
    }

    /**
     * Registers all slash commands currently stored in the client instance and thus updates the command syntax known to the Discord bot
     */
    private registerCommands = () => {
        const commands_json: any[] = [];
    
        for (const cmd of this.client.commands) {
            commands_json.push(cmd[1].data.toJSON());
            console.info(`Added ${cmd[0]} to command register.`);
        }
    
        const rest = new Discord.REST({ version: '10' }).setToken(token);
    
        rest.put(Discord.Routes.applicationCommands(clientId), { body: commands_json })
            .then(() => console.info('Successfully registered application commands.'))
            .catch(console.error);
    }

    /**
     * Map of all callable aliases for the defined functions
     */
    public callables: FunctionMap = {
        quit: this.exit,
        exit: this.exit,
        stop: this.exit,
        say: this.say,
        dm: this.dm,
        registerCommands: this.registerCommands,
        register: this.registerCommands,
    }
}
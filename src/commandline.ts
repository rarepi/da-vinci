import Discord from "discord.js"
import { clientId, token } from '../config.json';
import { ClientWithCommands } from './commandType';
import { sendDirectMessage, sendChannelMessage } from './DiscordFunctionWrappers'

type FunctionMap = {
    [name:string]: (...args:any) => void
};

class CLI {
    client: ClientWithCommands;
    constructor(client: ClientWithCommands) {
        this.client = client;
    }

    private exit = (code?: number | string) => {
        this.client.user?.setStatus('dnd');
        code = Number(code);
        console.info(`Shutting down...`);
        process.exit(code);
    }

    private say = async (channelId: string, ...message: string[]) => {
        await sendChannelMessage(this.client, channelId, ...message);
    }

    private dm = async (userId: string, ...message: string[]) => {
        await sendDirectMessage(this.client, userId, ...message);
    }

    private registerCommands = () => {
        const commands_json: any[] = []
    
        for (const cmd of this.client.commands) {
            commands_json.push(cmd[1].data.toJSON());
            console.info(`Added ${cmd[0]} to command register.`);
        }
    
        const rest = new Discord.REST({ version: '10' }).setToken(token);
    
        rest.put(Discord.Routes.applicationCommands(clientId), { body: commands_json })
            .then(() => console.info('Successfully registered application commands.'))
            .catch(console.error);
    }

    public callables: FunctionMap = {
        quit: this.exit,
        exit: this.exit,
        say: this.say,
        dm: this.dm,
        registerCommands: this.registerCommands,
        register: this.registerCommands,
    }
}


export default CLI;
import Discord from "discord.js"
import { clientId, token } from './config.json';
import fs from 'fs';
import { ClientWithCommands } from './commandType'

type FunctionMap = {
    [name:string]: (...args:any) => void
};

class CLI {
    client: ClientWithCommands;
    constructor(client: ClientWithCommands) {
        this.client = client;
    }

    private exit = (code?: number | string) => {
        code = Number(code);
        console.info(`Shutting down...`)
        process.exit(code);
    }

    private say = (channelId: string, ...message: string[]) => {
        this.client.channels.fetch(channelId).then(channel => {
            if(channel?.isTextBased() && !channel.isDMBased()) {
                channel.send(message.join(' ')).catch((error:any) => console.error(`[${error.code}] ${error.message}`));
            }
        }).catch((error:any) => {
            if(error.code == 10003) {
                console.error(`Channel not found.`)
            } else console.error(`[${error.code}] ${error.message}`)
        });
    }

    private dm = (userId: string, ...message: string[]) => {
        this.client.users.createDM(userId).then(dm => {
            dm.send(message.join(' ')).catch((error:any) => console.error(`[${error.code}] ${error.message}`));
        }).catch((error:any) => {
            if(error.code == 50033) {
                console.error(`Invalid user.`)
            } else console.error(`[${error.code}] ${error.message}`)
        });
    }

    private registerCommands = () => {
        const commands_json: any[] = []
    
        for (const cmd of this.client.commands) {
            commands_json.push(cmd[1].data.toJSON());
            console.info(`Added ${cmd[0]} to command register.`)
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
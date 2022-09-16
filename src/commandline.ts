import Discord from "discord.js"

type FunctionMap = { [name:string]: (...args:any) => void };

class CLI {
    client: Discord.Client;
    constructor(client: Discord.Client) {
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

    public callables: FunctionMap = {
        quit: this.exit,
        exit: this.exit,
        say: this.say,
        dm: this.dm,
    }
}


export default CLI;
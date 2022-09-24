import Discord from "discord.js"

export interface Command {
    prepare?: Function,
    data: Discord.SlashCommandBuilder,
    execute: Function,
    autocomplete?: Function
}

export class ClientWithCommands extends Discord.Client {
    commands : Discord.Collection<string, Command>

    constructor(options: Discord.ClientOptions) {
        super(options)
        this.commands = new Discord.Collection<string, Command>();
    }
}
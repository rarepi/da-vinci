import Discord from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';

module.exports = {
	data: new SlashCommandBuilder()
		.setName('lolify')
		.setDescription('Makes Da Vinci switch to her Rider class. (Changes her avatar. Discord might delay the change.)'),
	async execute(interaction:Discord.CommandInteraction) {
        await interaction.client.user?.setAvatar("img/da_vinci_rider.png");
        await interaction.reply("Servant, Rider. There was this and that, so I became the second Da Vinci-chan.");
	},
};
import Discord from "discord.js"
import { SlashCommandBuilder } from '@discordjs/builders';

module.exports = {
	data: new SlashCommandBuilder()
		.setName('legalize')
		.setDescription('Makes Da Vinci switch to her Caster class. (Changes her avatar. Discord might delay the change.)'),
	async execute(interaction:Discord.CommandInteraction) {
        interaction.client.user?.setAvatar("img/da_vinci_caster.png");
        await new Promise(resolve => setTimeout(resolve, 1000)); // wait for avatar change
        interaction.reply("Nice to meet you once again. I am servant Leonardo Da Vinci. Yes, from now on, I will be Da Vinci-chan only for you!")
	},
};
module.exports = {
	name: 'lolify',
	description: 'Makes Da Vinci switch to her Rider class. (Changes her avatar. Discord might delay the change.)',
	execute(message, args) {
		message.client.user.setAvatar("./images/avatar/da_vinci_rider.png");
		message.channel.send("Servant, Rider. There was this and that, so I became the second Da Vinci-chan.");
	},
};
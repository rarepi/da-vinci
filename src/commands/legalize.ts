module.exports = {
    name: 'legalize',
    description: 'Makes Da Vinci switch to her Caster class. (Changes her avatar. Discord might delay the change.)',
    execute(message, args) {
        message.client.user.setAvatar("./images/avatar/da_vinci_caster.png");
        message.channel.send("Nice to meet you once again. I am servant Leonardo Da Vinci. Yes, from now on, I will be Da Vinci-chan only for you!")
    },
};
const axios = require('axios');
const Discord = require('discord.js');
const db = require('../models.js');
const Canvas = require('canvas');
const {Op} = require('sequelize');

//const MAX_TEXT_WIDTH = 855;	//proper measurements
const MAX_TEXT_WIDTH = 860;		//adjusted measurements to compensate for wrong letter spacing
const DIALOG_HEIGHT = 575;
const DIALOG_WIDTH = 1024;
const LIST_PAGE_SIZE = 15;
const URL_FANDOM = "https://fategrandorder.fandom.com";


// returns a message listing the items of modelArray seperated into pages. modelArray must have a name field.
function generateListMessage(dataArray, page, max_pages) {
	let listStr = "```";
	if(page > 0) {
		listStr += `... \n`
	}
	for (let i = LIST_PAGE_SIZE*page ; i < LIST_PAGE_SIZE+LIST_PAGE_SIZE*page
		&& i < dataArray.length ; i++) {
		listStr += `[#${i}] ${dataArray[i].name}\n`;
	}
	if (page < max_pages) {
		listStr += `...`
	}
	listStr += "```";
	return listStr;
}

async function awaitIdxSelectionFromList(message, dataArray) {
	let page = 0;
	const max_pages = Math.floor(dataArray.length/LIST_PAGE_SIZE);
	let listMessage = await message.channel.send(`${generateListMessage(dataArray, page, max_pages)}`)
		.catch(error => console.error('Failed to send servant list message: ', error));
		try {
				await listMessage.react('⬇️');
				await listMessage.react('⬆️');
		} catch (error) {
			if (error.code == Discord.Constants.APIErrors.UNKNOWN_MESSAGE)
				return;		// List got deleted while adding reactions, so just cancel this.
			console.error("Error encountered while adding reactions.", error);
		}

	const listPagesFilter = (reaction, user) => {
		return ['⬆️', '⬇️'].includes(reaction.emoji.name) && user.id === message.author.id;
	};
	const pageControlCollector = listMessage.createReactionCollector(listPagesFilter);
	pageControlCollector.on('collect', async (reaction, user) => {
		reaction.users.remove(user)
		if (reaction.emoji.name === '⬆️' && page > 0) {
			page--;
		} else if (reaction.emoji.name === '⬇️' && page < max_pages) {
			page++;
		} else {
			return;
		}
		await listMessage.edit(generateListMessage(dataArray, page, max_pages))
			.catch(error => console.error('Failed edit message: ', error));
	});

	const selectFilter = response => {
		response_number = response.content.replace('#', '');
		if (response_number >= dataArray.length) {
			message.channel.send(`Please select an ID between 0 and ${dataArray.length-1}.`)
				.catch(error => console.error('Failed to send message: ', error));
			return false;
		}
		if (response_number < 0) {
			message.channel.send(`You're being way too negative.`)
				.catch(error => console.error('Failed to send message: ', error));
			return false;
		}
		return !isNaN(response_number) && response.author.id === message.author.id;
	}

	return await message.channel.awaitMessages(selectFilter, { max: 1 })
		.then(collected => {
			const itemIdx = collected.first().content.replace('#', '');
			pageControlCollector.stop();
			listMessage.delete();
			collected.first().delete()
			return itemIdx;
		});
}

async function buildIndexedExpressionSheet(path, bodyWidth, bodyHeight, eWidth, eHeight) {
	const canvas = Canvas.createCanvas(bodyWidth, bodyHeight);
	const context = canvas.getContext('2d');
	const sheet = await Canvas.loadImage(path);
	canvas.width = sheet.width
	canvas.height = sheet.height-bodyHeight
	context.drawImage(sheet, 
		0, bodyHeight, 
		sheet.width, sheet.height-bodyHeight, 
		0, 0, 
		sheet.width, sheet.height-bodyHeight);

	// calculate expression sprite count
	const e_row_count = Math.ceil((sheet.height - bodyHeight)/eHeight);
	const e_per_row = Math.ceil(sheet.width/eWidth);

	fontSize = 60;
	context.font = `${fontSize}px FOT-Skip Std B`;
	context.fillStyle = '#d8d7db';
	context.textTracking
	context.strokeStyle = 'black';
	context.lineWidth = 10;

	expression_id = 0;
	while(expression_id < e_row_count*e_per_row && expression_id >= 0) {
		x = eWidth * (expression_id % e_per_row);
		y = eHeight * Math.floor(expression_id/e_per_row)
		context.strokeText(expression_id.toString(), x+fontSize*0.30, y+fontSize*1.25);
		context.fillText(
			expression_id.toString(), 
			x+fontSize*0.30, 
			y+fontSize*1.25
			);
		expression_id += 1;
	}
	return {
		image: canvas.toBuffer(),
		count: e_row_count*e_per_row
	}
}

async function expressionIdxSelectMessage(message, indexedExpressionSheet) {
	const expressionSheetImage = new Discord.MessageAttachment(indexedExpressionSheet.image, 'expressions.png');
	sheetMsg = await message.channel.send(expressionSheetImage)
		.catch(error => console.error('Failed to send message: ', error));

	const selectFilter = response => {
		response_number = response.content.replace('#', '');
		if (response_number >= indexedExpressionSheet.count) {
			message.channel.send(`Please select an ID between 0 and ${indexedExpressionSheet.count-1}.`)
				.catch(error => console.error('Failed to send message: ', error));
			return false;
		}
		if (response_number < 0) {
			message.channel.send(`You're being way too negative.`)
				.catch(error => console.error('Failed to send message: ', error));
			return false;
		}
		return !isNaN(response_number) && response.author.id === message.author.id;
	}

	return await message.channel.awaitMessages(selectFilter, { max: 1 })
		.then(collected => {
			const itemIdx = collected.first().content.replace('#', '');
			sheetMsg.delete();
			collected.first().delete()
			return itemIdx;
		});
}

async function buildCharacterDialog(path, bodyWidth, bodyHeight, headX, headY, eWidth, eHeight, 
		dialogOffsetX, dialogOffsetY, specialFormat, name, expressionIdx, text) {

	// prepare sheet
	const canvas = Canvas.createCanvas(DIALOG_WIDTH, DIALOG_HEIGHT);
	const context = canvas.getContext('2d');
	const sheet = await Canvas.loadImage(path);
	dialogOffsetX += Math.floor(DIALOG_WIDTH-bodyWidth)/2
	context.drawImage(sheet, 
		0, 0, 
		bodyWidth, bodyHeight, 
		dialogOffsetX, dialogOffsetY, 
		bodyWidth, bodyHeight);

	if(specialFormat == 0) {	// default format: rows of faces below body sprite
		// cut out default face on body
		context.clearRect(
			headX+dialogOffsetX, headY+dialogOffsetY, 
			eWidth, eHeight);

		// calculate expression sprite count
		const e_row_count = Math.ceil((sheet.height - bodyHeight) / eHeight);
		const e_per_row = Math.ceil(sheet.width/eWidth);
		// check if given id is within bounds
		if(expressionIdx >= e_row_count*e_per_row || expressionIdx < 0) {
			console.log(`Given invalid expression ID! Defaulting to 0.`);
			expressionIdx = 0;
		}
		// insert face
		context.drawImage(sheet, 
			eWidth * (expressionIdx % e_per_row), 
			eHeight * Math.floor(expressionIdx/e_per_row) + bodyHeight, 
			eWidth, eHeight, 
			headX+dialogOffsetX, headY+dialogOffsetY, 
			eWidth, eHeight);
	}

	// insert dialog box
	const dbox = await Canvas.loadImage('./images/dialog_box.png');
	context.globalAlpha = 0.85;
	context.drawImage(dbox, 0, 389);
	context.globalAlpha = 1.0;

	// prepare lines
	const lines = [];
	context.font = "30px FOT-Skip Std B";
	context.fillStyle = '#d8d7db';
	context.shadowOffsetX = 2;
	context.shadowOffsetY = 1;
	context.shadowColor = "rgba(0,0,0,1.0)";
	context.shadowBlur = 2;
	context.textTracking

	if (context.measureText(text).width > MAX_TEXT_WIDTH) {
		const words = text.split(' ')
		var line = words[0];
		for (var i = 1; i < words.length; i++) {
			const word = words[i];
			if (context.measureText(`${line} ${word}`).width <= MAX_TEXT_WIDTH) {
				line += ` ${word}`;
			} else if (lines.length < 1) {
				lines.push(line);
				line = word;
			} else {
				//TODO could just generate additional images for additional lines.
				console.log(`Text is too long for two lines of text!`);
				break;
			}
		}
		lines.push(line);
	} else {
		lines.push(text)
	}

	// insert lines
	context.fillText(name, 27, 425);
	//context.fillText(lines[0], 72, 490);	//proper measurements
	context.fillText(lines[0], 70, 490);	//adjusted measurements to compensate for wrong letter spacing
	if(lines.length >= 2) {
		//context.fillText(lines[1], 72, 540);	//proper measurements
		context.fillText(lines[1], 70, 540);	//adjusted
	}
	return canvas.toBuffer();
}

module.exports = {
	name: 'servant',
	description: 'Search for a Servant from Fate/Grand Order.',
	async execute(message, args) {
		var sheetId;
		var text;
		var selectedServant;
		var selectedSheet;

		//determine arguments
		if(args.length < 1) {	//no args given
			message.channel.send("You need to at least supply a text for the dialog box.\ne.g. ```§servant Hello!```")
				.catch(error => console.error('Failed to send message: ', error));
			return;
		} else if (/^\[\d+\]$/g.test(args[0])){		// first arg is formatted as: [any integer]
			sheetId = parseInt(args.shift().replace(/[\[\]]/g, ''));
		}
		text = args.join(' ');

		const ServantClasses = db["classes"];
		const Servants = db["servants"];
		const Sheets = db["sheets"];

		//if no sheetId was given, run the whole process of selecting a servant and a character sheet
		if(sheetId == null) {
			const servantClasses = await ServantClasses.findAll({
				order: [
					['iconId', 'ASC']
				],
			});
			const servantClasses_records = servantClasses.map(c => c.dataValues)
			var pickerMsg;
			var selectedClass;
			var servants;
			var sheets;

			pickerMsg = await message.channel.send('Pick a class.')
				.catch(error => console.error('Failed to send message.', error));
			for(const servantClass of servantClasses_records) {
					await pickerMsg.react(servantClass.iconId)
						.catch(error => {
							if (error.code == Discord.Constants.APIErrors.UNKNOWN_MESSAGE)
								return;		// Picker got deleted while adding reactions, so just cancel this forEach.
							console.error("Error encountered while adding reaction.", error);
						})
			}
		
			// await user's selection of class (by reaction)
			const classesReactionsFilter = async (reaction, user) => {
				selectedClass = await ServantClasses.findByPk(reaction.emoji.id)
					.catch(error => console.error("Error encountered while comparing reaction to database.", error));
				return selectedClass && user.id === message.author.id;
			};
			await pickerMsg.awaitReactions(classesReactionsFilter, { max: 1})
				.then(collected => {
					pickerMsg.delete().catch(console.error);
				})
				.catch(error => console.error('Error encountered while collecting reaction.', error));
			
			// fetch all servants of chosen class
			servants = await Servants.findByClass(selectedClass.iconId)
				.catch(error => console.error("Error encountered while fetching servant list from database.", error));
			let servant_records = servants.map(s => s.dataValues)

			// await user's selection of servant (by index)
			let servantSelectionMsg = await message.channel.send(
				`Here's a complete list of all ${selectedClass.name} servants. Pick one by posting their # in chat.`
			).catch(error => console.error('Failed to send message.', error));

			const servantSelectionIdx = await awaitIdxSelectionFromList(message, servant_records)
				.then(result => {
					servantSelectionMsg.delete().catch(console.error);
					return result;
				})
				.catch(error => console.error('Error encountered while collecting servant selection.', error));;
			selectedServant = servant_records[servantSelectionIdx];

			// fetch id, name of all character sheets of chosen servant
			sheets = await Sheets.findNamesByServantSupported(servant_records[servantSelectionIdx].id)
				.catch(error => console.error("Error encountered while fetching sheet list from database.", error));;
			let sheets_records = sheets.map(s => s.dataValues)

			// await user's selection of character sheet (by index)
			const sheetSelectionMsg = await message.channel.send(
				`And here are ${selectedServant.name}'s character sheets. Pick one by posting their # in chat.`
				).catch(error => console.error('Failed to send message.', error));
			const sheetSelectionIdx = await awaitIdxSelectionFromList(message, sheets_records)
				.then(result => {
					sheetSelectionMsg.delete();
					return result;
				})
				.catch(error => console.error('Error encountered while collecting sheet selection.', error));

			// fetch selected sheet
			selectedSheet = await Sheets.findByPk(sheets_records[sheetSelectionIdx].id)
				.catch(error => console.error("Error encountered while fetching selected sheet from database.", error));
		} else {
			// fetch selected sheet
			selectedSheet = await Sheets.findByPk(sheetId)
				.catch(error => console.error("Error encountered while fetching selected sheet from database.", error));

			if(selectedSheet == null) {
				message.channel.send(`There is no character sheet with the ID ${sheetId}.`)
					.catch(error => console.error('Failed to send message.', error));
				return;
			}
			// fetch selected servant
			selectedServant = await Servants.findOne({
				where: {id: selectedSheet.servant},
				attributes: ['name', 'shortName']	// alias "shortName" as "name"
			}).catch(error => console.error("Error encountered while fetching selected servant from database.", error));
		}
		servantName = selectedServant.shortName != null ? selectedServant.shortName : selectedServant.name;

		var expressionIdx;
		if(selectedSheet.specialFormat == 0 && selectedSheet.eWidth > 0 && selectedSheet.eWidth > 0) {
			const expressionSelectionMsg = await message.channel.send(
				`These are the available expressions for this character sheet. Pick one by posting their # in chat.`
				).catch(error => console.error('Failed to send message.', error));
			indexedExpressionSheet = await buildIndexedExpressionSheet(
				selectedSheet.path, selectedSheet.bodyWidth, selectedSheet.bodyHeight, 
				selectedSheet.eWidth, selectedSheet.eHeight
				).catch(error => console.error('Error encountered while indexing expression sheet.', error));
			expressionIdx = await expressionIdxSelectMessage(message, indexedExpressionSheet)
				.then(result => {
					expressionSelectionMsg.delete().catch(console.error);
					return result;
				})
				.catch(error => console.error('Error encountered while collecting expression selection.', error));
		} else {
			expressionIdx = 0;
		}

		const imageBuffer = await buildCharacterDialog(
			selectedSheet.path, selectedSheet.bodyWidth, selectedSheet.bodyHeight, selectedSheet.headX, selectedSheet.headY, 
			selectedSheet.eWidth, selectedSheet.eHeight, selectedSheet.dialogOffsetX, selectedSheet.dialogOffsetY,
			selectedSheet.specialFormat, servantName, expressionIdx, text
		);

		// send image to Discord
		const attachment = new Discord.MessageAttachment(imageBuffer, 'dialogue.png');
		await message.channel.send(attachment);
		if(sheetId == null) {
			message.channel.send(`You can also select this character sheet directly by typing:**\`§servant [${selectedSheet.id}] text\`**`)
				.catch(error => console.error('Failed to send message.', error));
		}
	},
};
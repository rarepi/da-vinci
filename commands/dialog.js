const axios = require('axios');
const Discord = require('discord.js');
const db = require('../models.js');
const Canvas = require('canvas');
const {Op} = require('sequelize');
const Path = require('path');

const COMMAND_NAME = Path.basename(module.filename, Path.extname(module.filename))
const LIST_PAGE_SIZE = 15;
const URL_FANDOM = "https://fategrandorder.fandom.com";

const ServantClasses = db["classes"];
const Servants = db["servants"];
const Sheets = db["sheets"];

// returns a message listing the items of modelArray seperated into pages. modelArray must have a name field.
function generateItemListString(dataInstance, page, max_pages, markStatus=false) {
	let listStr = "```";
	if(page > 0) {
		listStr += `... \n`
	}
	for (let i = LIST_PAGE_SIZE*page ; i < LIST_PAGE_SIZE+LIST_PAGE_SIZE*page
		&& i < dataInstance.length ; i++) {
		listStr += `[#${i}] ${dataInstance[i].dataValues.name}`;
		//if(markStatus && !dataInstance[i].status() === false) {
		if(markStatus && !dataInstance[i].status()) {
			listStr += " (*)";
		}
		listStr += "\n";
	}
	if (page < max_pages) {
		listStr += `...`
	}
	listStr += "```";
	return listStr;
}

async function awaitIdxSelectionFromList(message, dataInstance, markStatus=false) {
	let page = 0;
	const max_pages = Math.floor(dataInstance.length/LIST_PAGE_SIZE);
	let listMessage = await message.channel.send(`${generateItemListString(dataInstance, page, max_pages, markStatus)}`)
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
		await listMessage.edit(generateItemListString(dataInstance, page, max_pages))
			.catch(error => console.error('Failed edit message: ', error));
	});

	const selectFilter = response => {
		response_number = response.content.replace('#', '');
		if (response_number >= dataInstance.length) {
			message.channel.send(`Please select an ID between 0 and ${dataInstance.length-1}.`)
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

// returns true if image data contains any pixeldata we define as relevant (defined as pixels with < 50% transparency)
function containsSpriteData(imageData) {
	for(let i = 3; i < imageData.data.length; i += 4) {
		// some expression sheets have random semi-transparent artifacts in empty slots, so we can't just use an alpha of 0 as our condition.
		if(imageData.data[i] > 127) {
			return true;
		}
	}
	console.log("No sprite data found! Data length: ", imageData.data.length)
    return false;
}

function calculateExpressionSheetDimensions(sheetWidth, sheetHeight, bodyHeight, eWidth, eHeight) {
	const ePadding = (sheetHeight - bodyHeight) % eHeight;
	const eRows = Math.ceil((sheetHeight - bodyHeight - ePadding) / eHeight);
	//const eCols = sheetWidth % eWidth > eWidth*0.5 ? Math.ceil(sheetWidth/eWidth) : Math.floor(sheetWidth/eWidth);
	const eCols = sheetWidth % eWidth > eWidth*0.5 ? Math.ceil(sheetWidth/eWidth) : Math.floor(sheetWidth/eWidth);
	return [ePadding, eRows, eCols]
}

async function buildIndexedExpressionSheet(path, bodyWidth, bodyHeight, eWidth, eHeight) {
	const canvas = Canvas.createCanvas(bodyWidth, bodyHeight);
	const context = canvas.getContext('2d');
	const sheet = await Canvas.loadImage(path);

	// calculate expression sprite count
	const [ePadding, eRows, eCols] = calculateExpressionSheetDimensions(sheet.width, sheet.height, bodyHeight, eWidth, eHeight);
	const expressionsSheetHeight = sheet.height-bodyHeight-ePadding;
	canvas.width = sheet.width;
	canvas.height = expressionsSheetHeight;

	context.drawImage(sheet, 
		0, bodyHeight+ePadding, 
		sheet.width, expressionsSheetHeight, 
		0, 0, 
		sheet.width, expressionsSheetHeight);

	const fontSize = 60;
	context.font = `${fontSize}px FOT-Skip Std B`;
	context.fillStyle = '#d8d7db';
	context.textTracking
	context.strokeStyle = 'black';
	context.lineWidth = 10;

	var eCell = 0;
	const expressions = []
	while(eCell < eRows*eCols && eCell >= 0) {
		x = eWidth * (eCell % eCols);
		y = eHeight * Math.floor(eCell/eCols)
		let eSprite = context.getImageData(x, y, eWidth, eHeight)
		if(containsSpriteData(eSprite)) {
			expressions.push(eSprite);
			context.strokeText(expressions.length.toString(), x+fontSize*0.30, y+fontSize*1.25);
			context.fillText(
				expressions.length.toString(), 
				x+fontSize*0.30, 
				y+fontSize*1.25
				);
			}
			eCell += 1;
	}
	return {
		expressionSheet: canvas.toBuffer(),
		expressions: expressions
	}
}

async function expressionSelectionMessage(message, indexedExpressionSheet) {
	const expressionSheetImage = new Discord.MessageAttachment(indexedExpressionSheet.expressionSheet, 'expressions.png');
	sheetMsg = await message.channel.send(expressionSheetImage)
		.catch(error => console.error('Failed to send message: ', error));

	const selectFilter = response => {
		response_number = response.content.replace('#', '');
		if (response_number > indexedExpressionSheet.expressions.length) {
			message.channel.send(`Please select an ID between 0 and ${indexedExpressionSheet.expressions.length}.`)
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
			if(itemIdx === 0) {
				return null;
			}
			sheetMsg.delete();
			collected.first().delete()
			return indexedExpressionSheet.expressions[itemIdx-1];
		});
}

async function buildCharacterDialog(path, bodyWidth, bodyHeight, headX, headY, eWidth, eHeight, 
		dialogOffsetX, dialogOffsetY, specialFormat, name, expression, text) {

	// Dialog constants (positioning manually measured from various FGO screenshots)
	const Dialog = {
		TEXT_WIDTH: 860,			// adjusted measurement to compensate for wrong letter spacing. proper value: 855
		HEIGHT: 575,				
		WIDTH: 1024,
		// Dialog box and its positioning
		BOX_IMG: './images/dialog_box.png',
		BOX_X: 0,
		BOX_Y: 389,
		BOX_TEXT_X: 70,				// adjusted measurement to compensate for wrong letter spacing. proper value: 72
		BOX_TEXT1_Y: 490,			// line 1
		BOX_TEXT2_Y: 540,			// line 2
		// name (text)
		get NAME_X(){return 27+this.BOX_X},
		NAME_Y: 425,
		// nametag (the name's border / frame)
		NAMETAG_IMG_MID: './images/dialog_box_name_mid.png',
		NAMETAG_IMG_END: './images/dialog_box_name_end.png',
		get NAMETAG_X(){return this.NAME_X},
		get NAMETAG_Y(){return this.BOX_Y},
		NAMETAG_WIDTH_MIN: 214,		// TODO use this. Nametags (their MID) are this long even for character names like "BB".
	}


	// prepare sheet
	const canvas = Canvas.createCanvas(Dialog.WIDTH, Dialog.HEIGHT);
	const context = canvas.getContext('2d');
	const sheet = await Canvas.loadImage(path);
	dialogOffsetX += Math.floor(Dialog.WIDTH-bodyWidth)/2
	context.drawImage(sheet, 
		0, 0, 
		bodyWidth, bodyHeight, 
		dialogOffsetX, dialogOffsetY, 
		bodyWidth, bodyHeight
	);

	if(specialFormat == 0 && expression != null) {	// specialFormat == 0 equals the default format: 1+ rows of faces below body sprite
		// cut out default face on body
		context.clearRect(headX+dialogOffsetX, headY+dialogOffsetY, eWidth, eHeight);

		// insert face
		context.putImageData(expression, headX+dialogOffsetX, headY+dialogOffsetY);
	}

	// we're using clearRect() on the dialog box, so it gets a new canvas so we don't clip the character sprite
	const canvas_dbox = Canvas.createCanvas(Dialog.WIDTH, Dialog.HEIGHT);
	const context_dbox = canvas_dbox.getContext('2d');

	// define font settings. this is also relevant for measureText()
	context_dbox.font = "30px FOT-Skip Std B";
	context_dbox.fillStyle = '#d8d7db';
	context_dbox.globalAlpha = 0.85;

	// insert dialog box
	const dbox = await Canvas.loadImage(Dialog.BOX_IMG);
	context_dbox.drawImage(dbox, Dialog.BOX_X, Dialog.BOX_Y);

	// load nametag components
	const nametag_mid = await Canvas.loadImage(Dialog.NAMETAG_IMG_MID);
	const nametag_end = await Canvas.loadImage(Dialog.NAMETAG_IMG_END);

	// measure name width, use minimum width if it's too short
	const name_width = Math.max(context_dbox.measureText(name).width, Dialog.NAMETAG_WIDTH_MIN);

	// clear the nametag area so we can draw our transparent custom nametag
	context_dbox.clearRect(Dialog.NAMETAG_X, Dialog.NAMETAG_Y, name_width+nametag_end.width, nametag_mid.height);

	// draw nametag to fit the name width
	for(let i = 0; i < name_width; i++) {
		context_dbox.drawImage(nametag_mid, Dialog.NAMETAG_X+i, Dialog.NAMETAG_Y);
	}
	context_dbox.drawImage(nametag_end, Dialog.NAMETAG_X+name_width, Dialog.NAMETAG_Y);

	// prepare lines
	const lines = [];
	context_dbox.globalAlpha = 1.00;
	context_dbox.textTracking;
	context_dbox.shadowOffsetX = 2;	// NOTE: shadows also apply to drawImage(), so don't draw images with these settings active
	context_dbox.shadowOffsetY = 1;
	context_dbox.shadowColor = "rgba(0,0,0,1.0)";
	context_dbox.shadowBlur = 2;
	
	context_dbox.fillText(name, Dialog.NAME_X, Dialog.NAME_Y);

	if (context_dbox.measureText(text).width > Dialog.TEXT_WIDTH) {
		const words = text.split(' ')
		var line = words[0];
		for (var i = 1; i < words.length; i++) {
			const word = words[i];
			if (context_dbox.measureText(`${line} ${word}`).width <= Dialog.TEXT_WIDTH) {
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
	context_dbox.fillText(lines[0], Dialog.BOX_TEXT_X, Dialog.BOX_TEXT1_Y);
	if(lines.length >= 2) {
		context_dbox.fillText(lines[1], Dialog.BOX_TEXT_X, Dialog.BOX_TEXT2_Y);
	}

	context.drawImage(canvas_dbox, 0, 0);

	return canvas.toBuffer();
}

async function runClassPicker(initMessage) {
	// fetch all servant class IDs from db. Each one equals a respective FGO class icon emoji ID for Discord.
	const servantClasses = await ServantClasses.findAll({
		order: [
			['iconId', 'ASC']
		],
	});

	// send servant class picker message
	const pickerMsg = await initMessage.channel.send('Pick a class.')
		.catch(error => console.error('Failed to send message.', error));

	const iconIds = [];
	// add a reaction button for every servant class and cache all the fetched IDs for later use
	for(const servantClass of servantClasses) {
		const iconId = servantClass.dataValues.iconId;
		if(!pickerMsg.deleted) {
			await pickerMsg.react(iconId)
				.catch(error => {
					if (error.code == Discord.Constants.APIErrors.UNKNOWN_MESSAGE)
						pass;		// Picker got deleted while adding reactions, so just cancel this forEach.
					console.error("Error encountered while adding reaction.", error);
				})
			}
		iconIds.push(iconId);
	}

	// await user's selection of class (by reaction)
	const classesReactionsFilter = async (reaction, user) => {
		return iconIds.includes(reaction.emoji.id) && user.id === initMessage.author.id;
	};
	return pickerMsg.awaitReactions(classesReactionsFilter, { max: 1})
		.then(async reactions => {
			const selectedClass = await ServantClasses.findByPk(reactions.first().emoji.id)
				.catch(error => console.error("Error encountered while comparing reaction to database.", error));
			if(!pickerMsg.deleted) pickerMsg.delete().catch(console.error);
			return selectedClass
		})
		.catch(error => console.error('Error encountered while collecting reaction.', error));
}

async function runServantPicker(initMessage, servantClass) {
	console.log(servantClass)


	// fetch all servants of chosen class
	const servants = await Servants.findByClass(servantClass.dataValues.iconId)
		.catch(error => console.error("Error encountered while fetching servant list from database.", error));

	// await user's selection of servant (by index)
	const pickerMsg = await initMessage.channel.send(
			`Here's a list of all **${servantClass.dataValues.name}** servants. Pick one by posting their # in chat.`
		).catch(error => console.error('Failed to send message.', error));

	return await awaitIdxSelectionFromList(initMessage, servants)
		.then(idx => {
			if(!pickerMsg.deleted) pickerMsg.delete().catch(console.error);
			return servants[idx];
	}).catch(error => console.error('Error encountered while collecting servant selection.', error));;
}

async function runSheetPicker(initMessage, servant) {
	// fetch relevant data for displaying all supported character sheets of chosen servant
	const sheets = await Sheets.findSheetsForDisplay(servant.dataValues.id)
		.catch(error => console.error("Error encountered while fetching sheet list from database.", error));;

	// await user's selection of character sheet (by index)
	const pickerMsg = await initMessage.channel.send(
		`These are **${servant.dataValues.name}**'s character sheets. Pick one by posting their # in chat.`
		+`\n_(Sheets marked with an \`(*)\` have not been verified yet, so their result may be off._`
		).catch(error => console.error('Failed to send message.', error));
	const sheetIdx = await awaitIdxSelectionFromList(initMessage, sheets, true)
		.then(result => {
			if(!pickerMsg.deleted) pickerMsg.delete().catch(console.error);
			return result;
		}).catch(error => console.error('Error encountered while collecting sheet selection.', error));

	// fetch selected sheet
	return await Sheets.findByPk(sheets[sheetIdx].dataValues.id)
		.catch(error => console.error("Error encountered while fetching selected sheet from database.", error));
}

module.exports = {
	name: COMMAND_NAME,
	description: 'Builds a dialog screen as seen in Fate/Grand Order.',
	async execute(message, args) {
		var sheetId;
		var text;
		var selectedClass;
		var selectedServant;
		var selectedSheet;

		// determine arguments
		if(args.length < 1) {	// no args given
			message.channel.send("You need to at least supply a text for the dialog box.\ne.g. ```§servant Hello!```")
				.catch(error => console.error('Failed to send message: ', error));
			return;
		} else if (/^\[\d+\]$/g.test(args[0])){		// first arg is formatted as: [any integer]
			sheetId = parseInt(args.shift().replace(/[\[\]]/g, ''));
		}
		text = args.join(' ');

		// if no sheetId was given, run the whole process of selecting a servant and a character sheet
		if(sheetId == null) {
			selectedClass = await runClassPicker(message).catch(error => console.error('Class Picker failed.', error));
			selectedServant = await runServantPicker(message, selectedClass).catch(error => console.error('Servant Picker failed.', error));
			selectedSheet = await runSheetPicker(message, selectedServant).catch(error => console.error('Sheet Picker failed.', error));
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
				attributes: ['name']
			}).catch(error => console.error("Error encountered while fetching selected servant from database.", error));
		}
		const servantName = selectedServant.shortName != null ? selectedServant.shortName : selectedServant.name;

		var expression = null;
		if(selectedSheet.specialFormat == 0 && selectedSheet.eWidth > 0 && selectedSheet.eWidth > 0) {
			const indexedExpressionSheet = await buildIndexedExpressionSheet(
				selectedSheet.path, selectedSheet.bodyWidth, selectedSheet.bodyHeight, 
				selectedSheet.eWidth, selectedSheet.eHeight
			).catch(error => console.error('Error encountered while indexing expression sheet.', error));

			const expressionSelectionMsg = await message.channel.send(
				`These are the available expressions for this character sheet. Pick one by posting their # in chat. Type \`0\` to choose their default expression.`
			).catch(error => console.error('Failed to send message.', error));

			expression = await expressionSelectionMessage(message, indexedExpressionSheet)
				.then(result => {
					if(!expressionSelectionMsg.deleted) expressionSelectionMsg.delete().catch(console.error);
					return result;
				}).catch(error => console.error('Error encountered while collecting expression selection.', error));
		}

		const imageBuffer = await buildCharacterDialog(
			selectedSheet.path, selectedSheet.bodyWidth, selectedSheet.bodyHeight, selectedSheet.headX, selectedSheet.headY, 
			selectedSheet.eWidth, selectedSheet.eHeight, selectedSheet.dialogOffsetX, selectedSheet.dialogOffsetY,
			selectedSheet.specialFormat, servantName, expression, text
		);

		// send image to Discord
		const attachment = new Discord.MessageAttachment(imageBuffer, 'dialogue.png');
		await message.channel.send(attachment);
		if(sheetId == null) {
			message.channel.send(`You can also select this character sheet directly by typing: **\`§${COMMAND_NAME} [${selectedSheet.id}] text\`**`)
				.catch(error => console.error('Failed to send message.', error));
		}
	},
};
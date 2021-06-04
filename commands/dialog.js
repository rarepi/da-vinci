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
                return;        // List got deleted while adding reactions, so just cancel this.
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

async function buildCharacterDialog(path, bodyWidth, bodyHeight, headX, headY, eWidth, eHeight,
        dialogOffsetX, dialogOffsetY, specialFormat, name, expression, text) {

    // Dialog constants (positioning manually measured from various FGO screenshots)
    const Dialog = {
        TEXT_WIDTH: 860,            // adjusted measurement to compensate for wrong letter spacing. proper value: 855
        HEIGHT: 575,
        WIDTH: 1024,
        // Dialog box and its positioning
        BOX_IMG: './images/dialog_box.png',
        BOX_X: 0,
        BOX_Y: 389,
        BOX_TEXT_X: 70,                // adjusted measurement to compensate for wrong letter spacing. proper value: 72
        BOX_TEXT1_Y: 490,            // line 1
        BOX_TEXT2_Y: 540,            // line 2
        // name (text)
        get NAME_X(){return 27+this.BOX_X},
        NAME_Y: 425,
        // nametag (the name's border / frame)
        NAMETAG_IMG_MID: './images/dialog_box_name_mid.png',
        NAMETAG_IMG_END: './images/dialog_box_name_end.png',
        get NAMETAG_X(){return this.NAME_X},
        get NAMETAG_Y(){return this.BOX_Y},
        NAMETAG_WIDTH_MIN: 214,        // TODO use this. Nametags (their MID) are this long even for character names like "BB".
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

    if(specialFormat == 0 && expression != null) {    // specialFormat == 0 equals the default format: 1+ rows of faces below body sprite
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
    context_dbox.shadowOffsetX = 2;    // NOTE: shadows also apply to drawImage(), so don't draw images with these settings active
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
                        pass;        // Picker got deleted while adding reactions, so just cancel this forEach.
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

async function runExpressionPicker(message, indexedExpressionSheet) {
    const expressionSheetImage = new Discord.MessageAttachment(indexedExpressionSheet.expressionSheet, 'expressions.png');
    const expressionSelectionPrompt = await message.channel.send(
        `These are the available expressions for this character sheet. Pick one by posting their # in chat. Type \`0\` to choose their default expression.`,
        {files: [expressionSheetImage]}
    ).catch(error => console.error('Failed to send message.', error));

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
            if(!collected.first().deleted) collected.first().delete().catch(console.error);
            if(!expressionSelectionPrompt.deleted) expressionSelectionPrompt.delete().catch(console.error);
            return [indexedExpressionSheet.expressions[itemIdx-1], itemIdx];
        });
}

async function runDialogTextInput(message) {
    const textInputPrompt = await message.channel.send(`Input the dialog text for your generated image.`)
        .catch(error => console.error('Failed to send message.', error));

    const selectFilter = response => {
        return response.author.id === message.author.id;
    }
    return await message.channel.awaitMessages(selectFilter, { max: 1 })
        .then(collected => {
            const inputMsg = collected.first();
            const input = inputMsg.content;
            if(!inputMsg.deleted) inputMsg.delete().catch(console.error);
            if(!textInputPrompt.deleted) textInputPrompt.delete().catch(console.error);
            return input;
        });
}

module.exports = {
    name: COMMAND_NAME,
    description: 'Builds a dialog screen as seen in Fate/Grand Order.',
    async execute(message, args) {
        var servantId;
        var sheetId;
        var expressionId;
        var dialogText;
        var displayHint = false;

        // determine arguments
        const ARG_CASE = {
            SERVANT_NAME: /^[\w]+$/,                            // dialog servant name                          => dialog James Moriarty
            SERVANT: /^\[\d+\]$/,                               // dialog [servant_id]                          => dialog [123]
            SERVANT_AND_SHEET: /^\[\d+:\d+\]$/,                 // dialog [servant_id:sheet_id]                 => dialog [123:123]
            SERVANT_AND_SHEET_AND_EXPR: /^\[\d+:\d+:\d+\]$/,    // dialog [servant_id:sheet_id:expression_id]   => dialog [123:123:123]
            SHEET: /^\[:\d+\]$/,                                // dialog [:sheet_id]                           => dialog [:123]
            SHEET_AND_EXPR: /^\[:\d+:\d+\]$/                    // dialog [:sheet_id:expression_id]             => dialog [:123:123]
        }

        if(args.length < 1) {   // pick servant, sheet, expression id and input text
            displayHint = true; // if user supplied no IDs, inform them about the argument syntax after he's done.
        } else if (ARG_CASE.SERVANT_NAME.test(args[0])) {                       // search servant name and pick sheet, expression id and input text
            return; // TODO not yet implemented
        } else if (ARG_CASE.SERVANT.test(args[0])) {                            // pick sheet, expression id and input text
            const match = await args.shift().match(/\[(\d+)\]/);
            servantId = parseInt(match[1]);
        } else if (ARG_CASE.SERVANT_AND_SHEET.test(args[0])) {                  // pick expression id and input text
            const match = await args.shift().match(/\[(\d+):(\d+)\]/);
            servantId = parseInt(match[1]);
            sheetId = parseInt(match[2]);
        } else if (ARG_CASE.SERVANT_AND_SHEET_AND_EXPR.test(args[0])) {         // input text
            const match = await args.shift().match(/\[(\d+):(\d+):(\d+)\]/);
            servantId = parseInt(match[1]);
            sheetId = parseInt(match[2]);
            expressionId = parseInt(match[3]);
        } else if (ARG_CASE.SHEET.test(args[0])) {                              // pick expression id and input text
            const match = await args.shift().match(/\[:(\d+)\]/);
            sheetId = parseInt(match[1]);
        } else if (ARG_CASE.SHEET_AND_EXPR.test(args[0])) {                     // input text
            const match = await args.shift().match(/\[:(\d+):(\d+)\]/);
            sheetId = parseInt(match[1]);
            expressionId = parseInt(match[2]);
        } else {
            message.channel.send(`Invalid input. This error message could use more details.`)
                .catch(error => console.error('Failed to send message.', error));
            return;
        }
        dialogText = args.join(' ');    // if any arguments follow, it's (supposed to be) the dialog text.

        var selectedClass;
        var selectedServant;
        var selectedSheet;

        // Fetch servant if given. Let the user pick a sheet if neither servantId nor sheetId has been provided.
        if(servantId != null){  // if servant is given, fetch it from db
            selectedServant = await Servants.findByPk(servantId)
                .catch(error => console.error("Error encountered while fetching selected sheet from database.", error));
            if(selectedServant == null) {
                message.channel.send(`There is no servant with the ID ${sheetId}.`)
                    .catch(error => console.error('Failed to send message.', error));
                return;
            }
        } else if(sheetId == null){ // if neither servant nor sheet has been given, run the servant picking process
            selectedClass = await runClassPicker(message).catch(error => console.error('Class Picker failed.', error));
            selectedServant = await runServantPicker(message, selectedClass).catch(error => console.error('Servant Picker failed.', error));
            servantId = selectedServant.dataValues.id;
        }

        // Fetch sheet if given. User picks sheet if not.
        if (sheetId != null) {  // if sheet is given, fetch it from db.
            selectedSheet = await Sheets.findByPk(sheetId)
                .catch(error => console.error("Error encountered while fetching selected sheet from database.", error));
            if(selectedSheet == null) {
                message.channel.send(`There is no character sheet with the ID ${sheetId}.`).catch(error => console.error('Failed to send message.', error));
                return;
            }
            if(selectedServant == null) {   // if no servant has been decided, grab their id from the sheet and fetch their name from db.
                selectedServant = await Servants.findByPk(selectedSheet.servant)
                    .catch(error => console.error("Error encountered while fetching selected servant from database.", error));
                servantId = selectedServant.dataValues.id;
            }

        } else if(selectedServant != null) {    //if servant has been decided and sheet was not given, run the sheet picking process
            selectedSheet = await runSheetPicker(message, selectedServant).catch(error => console.error('Sheet Picker failed.', error));
            sheetId = selectedSheet.dataValues.id;
        }

        if(selectedServant == null || selectedSheet == null) {
            throw(`Invalid state reached. Servant is ${selectedServant}, Sheet is ${selectedSheet}.`)
        }

        const servantName = selectedServant.shortName != null ? selectedServant.shortName : selectedServant.name;

        var selectedExpression;
        if(selectedSheet.specialFormat == 0 && selectedSheet.eWidth > 0 && selectedSheet.eWidth > 0) {
            // puts indices on the expression sheet subimage for every valid expression
            // indexedExpressionSheet.expressionSheet returns the entire expression sheet, indexedExpressionSheet.expressions is an array of every subimage.
            const indexedExpressionSheet = await buildIndexedExpressionSheet(
                selectedSheet.path, selectedSheet.bodyWidth, selectedSheet.bodyHeight,
                selectedSheet.eWidth, selectedSheet.eHeight
            ).catch(error => console.error('Error encountered while indexing expression sheet.', error));

            if(expressionId === 0) {
                selectedExpression = null   // use default expression
            } else if(expressionId == null) {
                [selectedExpression, expressionId] = await runExpressionPicker(message, indexedExpressionSheet)
                    .catch(error => console.error('Error encountered while collecting expression selection.', error));
            } else {
                if(expressionId <= indexedExpressionSheet.expressions.length) {
                    selectedExpression = indexedExpressionSheet.expressions[expressionId-1];
                } else {
                    message.channel.send(`Invalid expression ID. ${selectedServant.dataValues.name} has a ID range of 0-${indexedExpressionSheet.expressions.length}`)
                        .catch(error => console.error('Failed to send message.', error))
                    return;
                }
            }
        }

        if(dialogText == null || dialogText.length <= 0) {
            dialogText = await runDialogTextInput(message)
            .catch(error => console.error('Error encountered while collecting dialog text input.', error));
        }

        const imageBuffer = await buildCharacterDialog(
            selectedSheet.path, selectedSheet.bodyWidth, selectedSheet.bodyHeight, selectedSheet.headX, selectedSheet.headY,
            selectedSheet.eWidth, selectedSheet.eHeight, selectedSheet.dialogOffsetX, selectedSheet.dialogOffsetY,
            selectedSheet.specialFormat, servantName, selectedExpression, dialogText
        );

        // send finished image to Discord
        const attachment = new Discord.MessageAttachment(imageBuffer, 'dialogue.png');
        await message.channel.send(attachment);
        if(displayHint) {
            message.channel.send(`Hint: You can generate this dialog directly by typing: **\`§${COMMAND_NAME} [:${sheetId}:${expressionId}] ${dialogText}\`**`)
                .catch(error => console.error('Failed to send message.', error));
        }
    },
};
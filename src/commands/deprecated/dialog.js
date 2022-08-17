const Discord = require('discord.js');
const db = require('../models.js');
const Canvas = require('canvas');
const Path = require('path');
const {command_prefix: COMMAND_PREFIX} = require('../config.json');
const {CommandCancellationError, IllegalStateError} = require('../errors/Errors.js');

const COMMAND_NAME = Path.basename(module.filename, Path.extname(module.filename))
const LIST_PAGE_SIZE = 15;

const ServantClasses = db["classes"];
const Servants = db["servants"];
const Sheets = db["sheets"];

// returns true if the given string matches this file's command
function matchesCurrentCommand(str) {
    return str.startsWith(`${COMMAND_PREFIX}${COMMAND_NAME}`);
}

// returns true if image data contains any pixeldata we define as relevant (defined as pixels with < 50% transparency)
function containsSpriteData(imageData) {
    for(let i = 3; i < imageData.data.length; i += 4) {
        // some expression sheets have random semi-transparent artifacts in empty slots, so we can't just use an alpha of 0 as our condition.
        if(imageData.data[i] > 127) {
            return true;
        }
    }
    return false;
}

// determines the dimensions of the expression sprite area and its top padding
function calculateExpressionSheetDimensions(sheetWidth, sheetHeight, bodyHeight, eWidth, eHeight) {
    const ePadding = (sheetHeight - bodyHeight) % eHeight;
    const eRows = Math.ceil((sheetHeight - bodyHeight - ePadding) / eHeight);
    //const eCols = sheetWidth % eWidth > eWidth*0.5 ? Math.ceil(sheetWidth/eWidth) : Math.floor(sheetWidth/eWidth);
    const eCols = sheetWidth % eWidth > eWidth*0.5 ? Math.ceil(sheetWidth/eWidth) : Math.floor(sheetWidth/eWidth);
    return [ePadding, eRows, eCols]
}

// puts an index on each valid expression sprite in a character sheet and returns both the 
// image data of the indexed expression image and an array of each expression's image data
async function buildIndexedExpressionSheet(path, bodyWidth, bodyHeight, eWidth, eHeight) {
    const canvas = Canvas.createCanvas(bodyWidth, bodyHeight);
    const context = canvas.getContext('2d');
    const sheet = await Canvas.loadImage(path);

    // calculate expression sprite count
    const [ePadding, eRows, eCols] 
        = calculateExpressionSheetDimensions(sheet.width, sheet.height, bodyHeight, eWidth, eHeight);
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

class dialog{
    constructor(initMessage, servantSearchStr, servantId, sheetId, expressionId, text){
        this.initMessage = initMessage;
        this.servantSearchStr = servantSearchStr;
        this.servantId = servantId;
        this.sheetId = sheetId;
        this.expressionId = expressionId;
        this.text = text;

        this.servantClass;
        this.servant;
        this.sheet;
        this.expression;

        this.rejects = [];

        const cancelFilter = (message) => {
            return matchesCurrentCommand(message.content) && message.author.id === initMessage.author.id;
        };
        const reexecutionCollector = this.initMessage.channel.createMessageCollector(cancelFilter);

        reexecutionCollector.on('collect', m => {
            reexecutionCollector.stop();
            while(this.rejects.length > 0) {
                this.rejects.pop()(new CommandCancellationError("Cancelled by reexecution."));
            }
        });

        reexecutionCollector.once('end', (collected, reason) => {
            //if(!pickerMsg?.deleted) pickerMsg?.delete().catch(console.error);
        });
    }

    // does nothing if no servant search or servantId is provided, but a sheetId is. In that case the sheetId must provide the correct servant via runSheetSetter().
    async runServantSetter() {
        if(this.servantSearchStr) {
            this.servant = await this.promptServantBySearchResults()
                .catch(error => {
                    console.error('Failed to prompt for Servant.', error);
                    return error;
                });

        } else if(this.servantId){  // if servant is given, fetch it from db
            this.servant = await Servants.findByPk(this.servantId)
                .catch(error => {
                    console.error("Error encountered while fetching selected servant from database.", error);
                    return error
                });
            if(!this.servant) {
                this.initMessage.channel.send(`There is no servant with the ID ${this.sheetId}.`)
                    .catch(error => console.error('Failed to send message.', error));
            }
        } else if(!this.sheetId) { // if neither servant nor sheet has been given, run the servant picking process
            this.class = await this.promptClass()
                .catch(error => {
                    console.error('Class picker failed.', error);
                    return error;
                });
            if(!this.class || this.class instanceof Error) {
                throw new IllegalStateError(`Invalid state reached. Servant class is ${this.class}.`);
            };
            this.servant = await this.promptServantByClass()
                .catch(error => {
                    console.error('Failed to prompt for Servant.', error);
                    return error;
                });
            this.servantId = this.servant?.dataValues?.id;
        }
        return this.servant;
    }

    async runSheetSetter() {
        if(!this.servant && !this.sheetId || this.servant instanceof Error) {
            throw new IllegalStateError(`Invalid state for picking a sheet. Sheet ID is "${this.sheetId}", servant is "${this.servant}".`)
        }

        // Fetch sheet if given. User picks sheet if not.
        if (this.sheetId) {  // if sheet is given, fetch it from db.
            this.sheet = await Sheets.findByPk(this.sheetId)
                .catch(error => {
                    console.error("Error encountered while fetching selected sheet from database.", error);
                    return error;
                });
            if(this.sheet == null) {
                this.initMessage.channel.send(`There is no character sheet with the ID ${this.sheetId}.`).catch(error => console.error('Failed to send message.', error));
            }
            if(!this.servant && this.sheet) {   // if no servant has been decided, grab their id from the sheet and fetch their name from db.
                this.servant = await Servants.findByPk(this.sheet.dataValues.servantId)
                    .catch(error => {
                        console.error("Error encountered while fetching selected servant from database.", error);
                        return error;
                    });
                this.servantId = this.servant?.dataValues?.id;
            }
        } else if(this.servant && !(this.servant instanceof Error)) {    // if servant has been decided and sheet was not given, run the sheet picking process
            this.sheet = await this.promptSheet().catch(error => {
                console.error('Sheet Picker failed.', error);
                return error;
            });
            // if(!this.sheet) return;    // sheet picker was cancelled
            this.sheetId = this.sheet?.dataValues?.id;
        }
        return this.sheet;
    }

    async runExpressionSetter() {
        if(!this.servant || !this.sheet || this.servant instanceof Error || this.sheet instanceof Error) {
            throw new IllegalStateError(`Invalid state for picking an expression. Servant is "${this.servant}", sheet is "${this.sheet}".`)
        }

        if(this.sheet.specialFormat === 0 && this.sheet.eWidth > 0 && this.sheet.eHeight > 0) {
            // puts indices on the expression sheet subimage for every valid expression
            // indexedExpressionSheet.expressionSheet returns the entire expression sheet, indexedExpressionSheet.expressions is an array of every subimage.
            const indexedExpressionSheet = await buildIndexedExpressionSheet(
                this.sheet.path, this.sheet.bodyWidth, this.sheet.bodyHeight,
                this.sheet.eWidth, this.sheet.eHeight
            ).catch(error => {
                console.error('Error encountered while indexing expression sheet.', error);
                //this.expression = error;
            });

            if(this.expressionId === 0) {
                this.expression = null   // use default expression
            } else if(!this.expressionId) {
                [this.expression, this.expressionId] = await this.promptExpression(indexedExpressionSheet)
                    .catch(error => {
                        console.error('Error encountered while collecting expression selection.', error);
                        return [error, null];
                    });
            } else {
                if(this.expressionId <= indexedExpressionSheet.expressions.length) {
                    this.expression = indexedExpressionSheet.expressions[expressionId-1];
                } else {
                    message.channel.send(`Invalid expression ID. ${this.servant.dataValues.name} has a ID range of 0-${indexedExpressionSheet.expressions.length}`)
                        .catch(error => console.error('Failed to send message.', error))
                    this.expression = new Error("TODO"); // TODO
                }
            }
        }
        return this.expression;
    }

    async runTextSetter() {
        if(this.text == null || this.text.length <= 0) {
            this.text = await this.promptText(this.initMessage)
                .catch(error => {
                    console.error('Error encountered while collecting dialog text input.', error);
                    this.text = error;
                });
        }
        return this.text;
    }

    // prompts the user to choose the servant class of his FGO servant
    promptClass() {
        return new Promise(async (resolve, reject) => {
            this.rejects.push(reject);

            // fetch all servant class IDs from db. Each one equals a respective FGO class icon emoji ID for Discord.
            const servantClasses = await ServantClasses.findAll({
                order: [
                    ['iconId', 'ASC']
                ],
            });

            // create a button for every servant class
            const buttons = [];     // array of MessageActionRows - one for each servant class group
            const iconIds = [];     // array of Integers - all servant class icon IDs
            for(const servantClass of servantClasses) {
                const classIconId = servantClass.dataValues.iconId;
                const classIconEmoji = this.initMessage.client.emojis.resolve(servantClass.dataValues.iconId);
                const classGroup = servantClass.dataValues.group;
                //const className = servantClass.dataValues.name;
                iconIds.push(classIconId);  // add id to list

                if(!buttons[classGroup]) { // initialize a MessageActionRow for every servant class group (5 max)
                    buttons[classGroup] = new Discord.MessageActionRow();
                    if(buttons.length > 5)
                        throw(`Tried to build ${buttons.length} rows of buttons. Message components are limited to 5 MessageActionRows.`)
                }

                // construct Button
                const button = new Discord.MessageButton({
                    customID: classIconId.toString(),
                    style: "SECONDARY",
                    type: "BUTTON",
                    emoji: classIconEmoji,
                });
                buttons[classGroup].addComponents(button); // add button to their group's row
            }
            
            // send servant class picker message
            const pickerMsg = await this.initMessage.channel.send('Pick a class.', {components: buttons})
                .catch(error => console.error('Failed to send message.', error));

            // await user's selection of class (by reaction)
            const filter = async (interaction) => {
                return iconIds.includes(interaction.customID) && interaction.user.id === this.initMessage.author.id;
            };
            pickerMsg.awaitMessageComponentInteractions(filter, { max: 1})
            .then(async interactions => {
                if(interactions.size <= 0) return;  // reached in case of a deleted picker message
                const result = await ServantClasses.findByPk(interactions.first().customID)
                    .catch(error => console.error("Error encountered while comparing reaction to database.", error));
                if(!pickerMsg.deleted) pickerMsg.delete().catch(console.error);
                this.rejects.pop();
                resolve(result);
            }).catch(error => console.error('Error encountered while collecting reaction.', error));
        });
    }

    // prompts the user to choose his FGO servant
    promptServantBySearchResults() {
        return new Promise(async (resolve, reject) => {
            this.rejects.push(reject);

            const servants = await Servants.findByName(this.servantSearchStr.replace(/ /g, "%"));
            if(servants.length === 0) {
                this.initMessage.channel.send(
                    `There are no servants matching your search for **${this.servantSearchStr}**.\n`
                    +`You can try a plain **\`${COMMAND_PREFIX}${COMMAND_NAME}\`** to search by class instead.`)
                return null;
            }
            const pickerMsgText = `These are the servants matching your search for **${this.servantSearchStr}**. Pick one by posting their # in chat.`

            // await user's selection of servant (by index)
            const pickerMsg = await this.initMessage.channel.send(pickerMsgText).catch(error => console.error('Failed to send message.', error));

            const result = await this.awaitIdxSelectionFromList(servants)
                .then(idx => {
                    if(!pickerMsg.deleted) pickerMsg.delete().catch(console.error);
                    return servants[idx];
            }).catch(error => console.error('Error encountered while collecting servant selection.', error));;
            this.rejects.pop();
            resolve(result);
        });
    }

    // prompts the user to choose his FGO servant
    promptServantByClass() {
        return new Promise(async (resolve, reject) => {
            this.rejects.push(reject);

            const servants = await Servants.findByClass(this.class.dataValues.iconId);
            const pickerMsgText = `Here's a list of all **${this.class.dataValues.name}** servants. Pick one by posting their # in chat.`

            // await user's selection of servant (by index)
            const pickerMsg = await this.initMessage.channel.send(pickerMsgText).catch(error => console.error('Failed to send message.', error));
            const result = await this.awaitIdxSelectionFromList(servants)
                .then(idx => {
                    if(!pickerMsg.deleted) pickerMsg.delete().catch(console.error);
                    return servants[idx];
            }).catch(error => console.error('Error encountered while collecting servant selection.', error));

            this.rejects.pop();
            resolve(result);
        });
    }

    // prompts the user to choose his servant's character sheet
    promptSheet() {
        return new Promise(async (resolve, reject) => {
            this.rejects.push(reject);

            // fetch relevant data for displaying all supported character sheets of chosen servant
            const sheets = await Sheets.findSheetsForDisplay(this.servant.dataValues.id)
                .catch(error => console.error("Error encountered while fetching sheet list from database.", error));;

            // await user's selection of character sheet (by index)
            const pickerMsg = await this.initMessage.channel.send(
                `These are **${this.servant.dataValues.name}**'s character sheets. Pick one by posting their # in chat.`
                +`\n_(Sheets marked with an \`(*)\` have not been verified yet, so their result may be off._`
                ).catch(error => console.error('Failed to send message.', error));
            const sheetIdx = await this.awaitIdxSelectionFromList(sheets, true)
                .then(result => {
                    if(!pickerMsg.deleted) pickerMsg.delete().catch(console.error);
                    return result;
                }).catch(error => console.error('Error encountered while collecting sheet selection.', error));

            // fetch selected sheet
            const result = await Sheets.findByPk(sheets[sheetIdx]?.dataValues.id)
                .catch(error => console.error("Error encountered while fetching selected sheet from database.", error));
            this.rejects.pop();
            resolve(result);
        });
    }

    // prompts the user to choose an expression from his servant's character sheet
    promptExpression(indexedExpressionSheet) {
        return new Promise(async (resolve, reject) => {
            this.rejects.push(reject);

            const expressionSheetImage = new Discord.MessageAttachment(indexedExpressionSheet.expressionSheet, 'expressions.png');
            const expressionSelectionPrompt = await this.initMessage.channel.send(
                `These are the available expressions for this character sheet. Pick one by posting their # in chat. Type \`0\` to choose their default expression.`,
                {files: [expressionSheetImage]}
            ).catch(error => console.error('Failed to send message.', error));

            const selectFilter = response => {
                const response_number = response.content.replace('#', '');
                if (response_number > indexedExpressionSheet.expressions.length) {
                    this.initMessage.channel.send(`Please select an ID between 0 and ${indexedExpressionSheet.expressions.length}.`)
                        .catch(error => console.error('Failed to send message: ', error));
                    return false;
                }
                if (response_number < 0) {
                    this.initMessage.channel.send(`You're being way too negative.`)
                        .catch(error => console.error('Failed to send message: ', error));
                    return false;
                }
                return !isNaN(response_number) && response.author.id === this.initMessage.author.id;
            }

            const result = await this.initMessage.channel.awaitMessages(selectFilter, { max: 1 })
                .then(collected => {
                    const itemIdx = collected.first().content.replace('#', '');
                    if(itemIdx === 0) {
                        return null;
                    }
                    if(!collected.first().deleted) collected.first().delete().catch(console.error);
                    if(!expressionSelectionPrompt.deleted) expressionSelectionPrompt.delete().catch(console.error);
                    return [indexedExpressionSheet.expressions[itemIdx-1], itemIdx];
                });
            this.rejects.pop();
            resolve(result);
        });
    }

    // prompts the user to input the text to be displayed in his character dialog box
    promptText() {
        return new Promise(async (resolve, reject) => {
            this.rejects.push(reject);

            const textInputPrompt = await this.initMessage.channel.send(`Input the dialog text for your generated image.`)
                .catch(error => console.error('Failed to send message.', error));

            const selectFilter = response => {
                return response.author.id === this.initMessage.author.id;
            }
            const result = await this.initMessage.channel.awaitMessages(selectFilter, { max: 1 })
                .then(collected => {
                    const inputMsg = collected.first();
                    const input = inputMsg.content;
                    if(!inputMsg.deleted) inputMsg.delete().catch(console.error);
                    if(!textInputPrompt.deleted) textInputPrompt.delete().catch(console.error);
                    return input;
                });
            this.rejects.pop();
            resolve(result);
        });
    }

    // constructs the final FGO character dialog image
    buildCharacterDialog() {
        return new Promise(async (resolve, reject) => {
            this.rejects.push(reject);

            // fixate all needed attributes (& shorter variable names for readability)
            const path = this.sheet.path;
            let bodyWidth = this.sheet.bodyWidth;
            let bodyHeight = this.sheet.bodyHeight;
            let headX = this.sheet.headX;
            let headY = this.sheet.headY;
            let eWidth = this.sheet.eWidth;
            let eHeight = this.sheet.eHeight;
            let dialogOffsetX = this.sheet.dialogOffsetX;
            let dialogOffsetY = this.sheet.dialogOffsetY;
            const specialFormat = this.sheet.specialFormat;
            let name = this.servant.shortName ? this.servant.shortName : this.servant.name;
            let expression = this.expression;
            let text = this.text;     

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

            this.rejects.pop();
            resolve(canvas.toBuffer());
        })
    }

    // awaits text input from user representing an index in a output indexed item list
    awaitIdxSelectionFromList(dataInstance, markStatus=false) {
        return new Promise(async (resolve, reject) => {
            this.rejects.push(reject);
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

            const buttons = [];     // array of MessageActionRows
            const emojis = [];
            const emojiDown = "⬇️";
            const emojiUp = "⬆️";
            emojis.push(emojiDown);
            emojis.push(emojiUp);

            // construct Buttons and add them to the message components
            buttons[0] = new Discord.MessageActionRow();
            for(const e of emojis) {
                const button = new Discord.MessageButton({
                    customID: e,
                    style: "SECONDARY",
                    type: "BUTTON",
                }).setEmoji(e);
                buttons[0].addComponents(button);
            }
            
            let page = 0;
            const max_pages = Math.floor(dataInstance.length/LIST_PAGE_SIZE);
            let listMessage = await this.initMessage.channel.send(`${generateItemListString(dataInstance, page, max_pages, markStatus)}`, {components: buttons})
                .catch(error => console.error('Failed to send servant list message: ', error));

            const listPagesFilter = (interaction) => {
                return emojis.includes(interaction.customID) && interaction.user.id === this.initMessage.author.id;
            };
            const pageControlCollector = listMessage.createMessageComponentInteractionCollector(listPagesFilter);

            pageControlCollector.on('collect', async (interaction) => {
                if (interaction.customID === emojiUp && page > 0) {
                    page--;
                } else if (interaction.customID === emojiDown && page < max_pages) {
                    page++;
                }
                // TODO find a way to acknowledge the button interaction without updating the message if page doesn't change
                await interaction.update(`${generateItemListString(dataInstance, page, max_pages, markStatus)}`, {components: buttons})
                    .catch(error => console.error('Failed to update message:', error));
            });

            pageControlCollector.on('end', (collection, reason) => {
                if(!listMessage.deleted) listMessage.delete().catch(console.error);
            });

            const selectFilter = response => {
                const response_number = response.content.replace('#', '');
                if (response_number >= dataInstance.length) {
                    this.initMessage.channel.send(`Please select an ID between 0 and ${dataInstance.length-1}.`)
                        .catch(error => console.error('Failed to send message: ', error));
                    return false;
                }
                if (response_number < 0) {
                    this.initMessage.channel.send(`You're being way too negative.`)
                        .catch(error => console.error('Failed to send message: ', error));
                    return false;
                }
                return !isNaN(response_number) && response.author.id === this.initMessage.author.id;
            }

            return await this.initMessage.channel.awaitMessages(selectFilter, { max: 1 })
                .then(collected => {
                    pageControlCollector.stop();
                    const responseMessage = collected.first();
                    const itemIdx = responseMessage.content.replace('#', '');
                    if(!responseMessage.deleted) responseMessage.delete().catch(console.error);
                    this.rejects.pop();
                    resolve(itemIdx);
                });
        })
    }
}







module.exports = {
    name: COMMAND_NAME,
    description: 'Builds a dialog screen as seen in Fate/Grand Order.',
    async execute(message, args) {
        var servantSearchStr;
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
            servantSearchStr = args.join(' ');
            args = [];
            displayHint = true;
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
        dialogText = args?.join(' ');    // if any arguments follow, it's (supposed to be) the dialog text.

        const dialogInstance = new dialog(message, servantSearchStr, servantId, sheetId, expressionId, dialogText);
        
        let result;
        result = await dialogInstance.runServantSetter();
        if(result instanceof Error) {
            return;
        }
        result = await dialogInstance.runSheetSetter();
        if(result instanceof Error) {
            return;
        }
        result = await dialogInstance.runExpressionSetter();
        if(result instanceof Error) {
            return;
        }
        result = await dialogInstance.runTextSetter();
        if(result instanceof Error) {
            return;
        }

        const imageBuffer = await dialogInstance.buildCharacterDialog();

        // send finished image to Discord
        const attachment = new Discord.MessageAttachment(imageBuffer, 'dialogue.png');
        await message.channel.send(attachment);
        if(displayHint) {
            message.channel.send(`Hint: You can generate this dialog directly by typing: `
            +`**\`${COMMAND_PREFIX}${COMMAND_NAME} [:${dialogInstance.sheetId}:${dialogInstance.expressionId}] ${dialogInstance.text}\`**`)
                .catch(error => console.error('Failed to send message.', error));
        }
    },
};
import Axios from 'axios';
import { spawn } from 'child_process';
import Fs from 'fs';
import Path from 'path';
import Discord from "discord.js"

const RGX_REDDIT_URL = /^[^\r\n]*(https?:\/\/(?:www\.)?reddit\.com\/r\/\w+?\/(?:comments\/)?\w+\/?)[^\r\n]*$/m
const RGX_REDDIT_VIDEO_URL = /(?<audioPrefix>https?:\/\/\S+\/(?<id>\w+)\/DASH_)\d+(?<audioSuffix>\.mp4)/ // [0] = clean file url   groups.id = file id   groups.audioPrefix + "audio" + groups.audioSuffix = audio url
const PATH_TO_DL_DIR = Path.resolve("./", 'temp');
Fs.promises.mkdir(PATH_TO_DL_DIR, { recursive: true }).catch(console.error);

/**
 * Obtains the file size of the provided URL
   * @param {string} url URL of the file
   * @returns {number} The file size
 */
async function requestFileSize(url: string): Promise<number> {
    let fileSize: number = 0;
    const response = await Axios({
        url,
        method: 'HEAD'
    })
        .catch(error => {
            if (error.response.status == 403)
                fileSize = 0;
            else
                console.error("Media not found.", error);
        });

    if (response != null && response.headers != null && "content-length" in response.headers)
        fileSize = parseInt(response.headers['content-length'])
    return fileSize;
}

/**
 * Downloads the provided URL and writes it to disk.
   * @param {string} url URL of the file
   * @param {string} filename The filename to be used when writing the file
   * @returns {Promise<string>} Path to the downloaded file
 */
async function downloadFile(url: string, filename: string): Promise<string> {
    const path = Path.resolve(PATH_TO_DL_DIR, filename)
    if (Fs.existsSync(path)) {
        console.info(`File '${path}' already exists. Skipping download of '${url}'.`);
        return path;
    }

    const writer = Fs.createWriteStream(path)
    const { data, headers } = await Axios({
        url,
        method: 'GET',
        responseType: 'stream',
    })

    data.on('data', (chunk: any[]) => {
        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);
        process.stdout.write(`Received ${chunk.length} bytes of data.`);
    })

    data.pipe(writer);

    return await new Promise((resolve, reject) => {
        writer.on('finish', () => {
            process.stdout.clearLine(0);
            process.stdout.cursorTo(0);
            process.stdout.write(`Download of ${url} completed.\n`);
            resolve(path);
        })
        writer.on('error', reject)
    })
}

export function setup(client: Discord.Client) {
    client.on('messageCreate', message => {
        if (message.author.bot) return; // ignore bot messages, including my own
        const match = RGX_REDDIT_URL.exec(message.content);
        if (match) {
            let reddit_url = match[1];
            console.debug(`Reddit link detected: ${reddit_url}`);
            execute(message, reddit_url);
        } else return;
    });
}

/**
 * Uploads the video of the provided reddit post as a proper video file
 * @param {Discord.Message} message The Discord message that triggered this function
 * @param {string} url The URL to the reddit video post
 * @todo rework the way the json data structure is used here
 */
async function execute(message: Discord.Message, url: string) {
    const result = (await Axios.get(`${url}.json`));

    // extract video and audio URLs
    let fallback_url: string;
    if (result?.data?.[0]?.data?.children?.[0]?.data?.crosspost_parent_list?.[0]?.media?.hasOwnProperty(`reddit_video`)) {
        fallback_url = result.data[0].data.children[0].data.crosspost_parent_list?.[0].media.reddit_video.fallback_url;
    } else if (result?.data?.[0]?.data?.children?.[0]?.data?.media?.hasOwnProperty(`reddit_video`)) {
        fallback_url = result.data[0].data.children[0].data.media.reddit_video.fallback_url;
    } else {
        return;
    }

    console.debug(`Extracted fallback url: ${fallback_url}`);
    const video_url = RGX_REDDIT_VIDEO_URL.exec(fallback_url);
    if (!video_url) {
        console.error(`Failed to extract video url.`);
        return;
    }
    const reddit_video = video_url[0];
    const reddit_audio = video_url.groups!.audioPrefix + "audio" + video_url.groups!.audioSuffix;
    const filename = video_url.groups!.id; // use reddit's video id as output filename


    // check if file size exceeds discord limits
    const videoSize = await requestFileSize(reddit_video)
        .catch(error => console.error(`File size request for ${reddit_video} failed.`, error));
    const audioSize = await requestFileSize(reddit_audio)
        .catch(error => console.error(`File size request for ${reddit_audio} failed.`, error));
    let estimatedFileSize = 0;
    if (videoSize && audioSize)
        estimatedFileSize = (videoSize + audioSize) / (1024 ** 2);
    if (estimatedFileSize > 8) {
        console.info(`Reddit Download skipped due to filesize of ${estimatedFileSize}MB. Discord allows uploads of up to 8MB for bots.`)
        return;
    }

    // download video
    let videoPath: string;
    if (videoSize && videoSize > 0) {
        videoPath = await downloadFile(reddit_video, `${filename}.mp4`)
            .catch(
                (error): string => {
                    console.error(`Failed to download ${reddit_video}`, error);
                    return "";
                });
    }
    // download audio
    let audioPath: string;
    if (audioSize && audioSize > 0) {
        audioPath = await downloadFile(reddit_audio, `${filename}.aac`)
            .catch(
                (error): string => {
                    console.error(`Failed to download ${reddit_audio}`, error);
                    return "";
                });
    }
    const outPath = `${PATH_TO_DL_DIR}\\${filename}_out.mp4`;

    let mux = new Promise<void>(function (success, nosuccess) {
        let pArgs = [`-n`]  // don't overwrite existing files
        if (videoPath) {
            pArgs.push(`-i`, videoPath);    // input file (video)
        }
        if (audioPath) {
            pArgs.push(`-i`, audioPath);    // input file (audio)
        }
        pArgs.push(`-c`, `copy`, `${outPath}`); // selects "copy" as encoder (just copies the input streams without encoding)
        pArgs.push(`-loglevel`, `warning`); // stops verbose stderr ( https://stackoverflow.com/a/35215447/5920409 ) although this apparently also silents stdout entirely, but atleast errors are detectable this way
        pArgs.push(`-nostats`)
        const p = spawn('ffmpeg', pArgs);
        var pOut = "";
        var pErr = "";

        // seems to be always empty with -loglevel warning
        p.stdout.on('data', (data: any) => {
            let dataStr = data.toString('utf8');
            pOut += dataStr;
        });

        p.stdout.on('close', () => {
            if(pOut.length > 0) {
                console.debug(`--- FFMPEG OUTPUT ---`)
                console.debug(pOut);
                console.debug(`---------------------`)
            }
            console.info(`Muxing completed.`);
            success();
        });

        p.stderr.on('data', (data: any) => {
            let dataStr = data.toString('utf8');
            pErr += dataStr;
        });

        p.stderr.on('close', () => {
            if(pErr.length > 0) {
                console.error(`--- FFMPEG ERROR ---`)
                console.error(pErr);
                console.error(`--------------------`)
            }
        });
    });

    await mux.catch(error => console.error('Failed muxing.', error));;

    const attachment = new Discord.AttachmentBuilder(outPath, { name: `${filename}.mp4` });
    await message.reply({ files: [attachment], allowedMentions: { repliedUser: false } })
        .catch(error => console.error("Failed to upload video to Discord.", error));
}
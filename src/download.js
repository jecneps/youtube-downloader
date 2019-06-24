const ytdl = require("ytdl-core")
const fs = require("fs")



function downloadVideo(url, trg) {
    ytdl(url, {
	format: "mp3"
    }).pipe(fs.createWriteStream(trg))
}

downloadVideo("https://www.youtube.com/watch?v=OI6vZfiKRho", "test.mp3")

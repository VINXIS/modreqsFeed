bancho = require("bancho.js")
discord = require("discord.js")
nodesu = require("nodesu")

linkregex = /(osu|old)\.ppy\.sh\/(s|b|beatmaps|beatmapsets)\/(\d+)(#osu\/(\d+))?/

// Initialization
api = new nodesu.Client(process.env.osuAPI)
osuClient = new bancho.BanchoClient({
    username: process.env.osuIRCUser,
    password: process.env.osuIRCPass
})
discordClient = new discord.Client()
discordClient.login(process.env.token)

discordClient.on("ready", () => {
    console.log(`Logged in as ${discordClient.user.tag}!`)
    osuClient.connect().then(async () => {
        console.log("We're online! Joining modreqs...");
        modReqCh = osuClient.getChannel("#modreqs")
        await modReqCh.join()
        console.log("Joined modreqs!");
        modReqCh.on("message", async (m) => {
            username = m.user.ircUsername
            message = m.message
            output = await parseInfo(username, message)
            if (!output)
                return
            (await discordClient.channels.fetch(process.env.feedChannel)).send({
                embed: {
                    author: {
                        name: output.mapset.title,
                        url: "https://osu.ppy.sh/s/" + output.mapset.id,
                        icon_url: "https://a.ppy.sh/" + output.user.user_id + "?" + (Math.random() * 100000)
                    },
                    thumbnail: {
                        url: "https://b.ppy.sh/thumb/" + output.mapset.id + "l.jpg"
                    },
                    description: output.mapset.sr.join("★, ") + "★\n" + "Drain Time: " + drain + "\n" + output.mapset.difficulties + " difficulties",
                    color: (output.ranked ? 8311585 : 13632027),
                }
            })
        })
    })
})

async function parseInfo(username, message) {
    if (!linkregex.test(message))
        return false

    r = linkregex.exec(message)
    
    user = (await api.user.get(username))

    map = {}
    set = []

    switch(r[2]) {
        case 'b':
        case 'beatmaps':
            map = (await api.beatmaps.getByBeatmapId(r[3]))[0]
            set = (await api.beatmaps.getBySetId(map.beatmapset_id))
            break
        case 's':
        case 'beatmapsets':
            set = (await api.beatmaps.getBySetId(r[3]))
            map = (await api.beatmaps.getByBeatmapId(set[0].beatmap_id))[0]
            break
    }
    
    if (map.mode !== "0" || user.user_id !== map.creator_id)
        return false

    userMaps = (await api.beatmaps.getByUser(username))

    ranked = false
    for (let index = 0; index < userMaps.length; index++) {
        status = userMaps[index].approved
        if ((status === "1" || status === "2" || status === "3") && map.mode === "0") {
            ranked = true
            break
        }
    }

    baseDrain = parseFloat(set.sort((a, b) => parseFloat(b.hit_length) - parseFloat(a.hit_length))[0].hit_length)
    minDrain = Math.floor(baseDrain / 60)
    secDrain = baseDrain - minDrain * 60
    drain = (new Array(3).join("0")+minDrain).slice(-2)+':'+(new Array(3).join("0")+secDrain).slice(-2)

    return {
        mapset: {
            id: set[0].beatmapset_id,
            title: set[0].artist + " - " + set[0].title + " by " + user.username,
            difficulties: set.length,
            sr: set.sort((a, b) => parseFloat(a.difficultyrating) - parseFloat(b.difficultyrating)).map(x => Math.round(parseFloat(x.difficultyrating) * 100) / 100),
            drain, 
        }, 
        ranked, 
        user}
}
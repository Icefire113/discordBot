require('dotenv').config()
const sqlite = require("sqlite3")
const Discord = require("discord.js")


const bot = new Discord.Client()
const db = new sqlite.Database(process.env.DBLOCALPATH, (err) => {
    if (err) console.error(`[DB] Error connecting to local database ${process.env.DBLOCALPATH} error message is: ${err.message}`)
    console.log(`[DB] Local database ${process.env.DBLOCALPATH} connected`)
})
const settings = require('./settings.json')

/* 
format:
[{
    guildid: -1,
    reactroles: [
            {
            roleid: -1,
            emoji: ""
        }
    ]
}]
*/
let reactrolesdatacache = []


bot.on('ready', () => {
    console.log(`[BOT] Logged in as ${bot.user.tag}`)
})

/*
create table if not exists \"reactroles\" (
	\"id\"	INTEGER NOT NULL,
	\"guildid\"	INTEGER NOT NULL UNIQUE,
	\"roleids\"	TEXT NOT NULL,
	PRIMARY KEY(\"id\" AUTOINCREMENT)
) 
*/
bot.on('message', (message) => {
    let args = message.content.replace(settings.prefix, "").split(" ")
    if (message.author.id != bot.user.id) {

        if (message.content.startsWith(settings.prefix)) {
            switch (args[0]) {
                case 'setreactchannel':
                    // See if server already has a react channel
                    db.get("select * from reactchannelid where guildid = " + message.guild.id, (err, row) => {
                        if (err) return console.error(`[DB] ${err.message}`)
                        if (row != undefined) {
                            bot.channels.fetch(row.channelid).then(channel => message.reply(`There is already a react channel for this server <#${channel.id}>`))
                        } else {
                            db.prepare("insert into reactchannelid values (null,?,?)")
                                .run([message.guild.id, message.channel.id], (err) => {
                                    if (err) return console.error(`[DB] ${err.message}`)
                                })
                        }

                    })
                    break;


                case 'safeshutdown':
                    if (message.author.id == process.env.OWNERID) {
                        db.close((err) => {
                            if (err) return console.error(`[DB] Error closing database error message is: ${err.message}`)
                            console.log(`[DB] Connection to local database closed`)
                        })
                        bot.destroy()
                        console.log(`[BOT] Logged out`)
                    }
                    break;


                case 'wipedb':
                    if (message.author.id == process.env.OWNERID) {
                        db.prepare("drop table if exists reactchannelid", (err) => {
                            if (err) return console.error(`[DB] ${err.message}`)
                        }).run().finalize()

                        db.prepare(`create table if not exists \"reactchannelid\" 
                                (\"id\" INTEGER NOT NULL,
                                \"guildid\" TEXT NOT NULL UNIQUE,
                                \"channelid\" TEXT NOT NULL UNIQUE,
                                PRIMARY KEY(\"id\" AUTOINCREMENT));`, (err) => {
                            if (err) return console.error(`[DB] ${err.message}`)
                        }).run().finalize()

                        // roleids is json and must be parsed
                        db.prepare(`create table if not exists \"reactroles\" (
                            \"id\"	INTEGER NOT NULL,
                            \"guildid\"	INTEGER NOT NULL UNIQUE,
                            \"roleids\"	TEXT NOT NULL,
                            PRIMARY KEY(\"id\" AUTOINCREMENT)
                        )`, (err) => {
                            if (err) return console.error(`[DB] ${err.message}`)
                        }).run().finalize()
                        console.log(`[DB] Database was wiped on ${Date()} by ${message.author.tag}`)
                        message.reply("Database wiped successfully")


                    }
                    break;


                case 'addrole':
                    if (message.mentions.roles.toJSON().length > 1) {
                        return message.reply("You mentioned to many roles, please use format: <@role> <emoji>")
                    }
                    message.mentions.roles.toJSON().forEach((e, i) => {
                        // check if there is a cache already existing
                        if (!reactrolesdatacache.find(({
                                guildid
                            }) => guildid == e.guild)) {

                            // add a new record to cache if there isnt one already
                            reactrolesdatacache.push({
                                guildid: e.guild,
                                reactroles: [{
                                    roleid: e.id,
                                    emoji: args[2]
                                }]
                            })
                        } else {
                            // add to the cache data cause one already exists
                            let index = reactrolesdatacache.findIndex(({
                                guildid
                            }) => guildid == e.guild)
                            reactrolesdatacache[index].reactroles.push({
                                roleid: e.id,
                                emoji: args[2]
                            })

                        }
                    })





                    break;
                case 'finalize':
                    db.get("select * from reactchannelid where guildid = " + message.guild.id, (err, row) => {
                        if (err) return console.error(`[DB] ${err.message}`)
                        let index = reactrolesdatacache.findIndex(({
                            guildid
                        }) => guildid == message.guild.id)

                        if (row == undefined) {
                            // server dosent have a react role set up
                            return message.reply(`This server dosent have a react role channel setup please use ${settings.prefix}setreactchannel to set one up`)
                        } else {
                            // server already has a react role setup
                            db.prepare(`insert into reactroles values (null, ?, ?)`, (err) => {
                                if (err) {
                                    message.reply('Error adding roles to database')
                                    return console.error(`[DB] ${err.message}`)
                                }

                            }).run([message.guild.id, JSON.stringify(reactrolesdatacache[index].reactroles)]).finalize()
                            // clear data from cache
                            reactrolesdatacache.splice(index, 1)

                            // add react roles to channel with reactions

                        }

                    })



                    break;
            }
        }

    }
})


bot.login(process.env.TOKEN)
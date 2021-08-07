require('dotenv').config()
const sqlite = require("sqlite3")
const fs = require('fs')
const Discord = require("discord.js")


const bot = new Discord.Client()
const db = new sqlite.Database(process.env.DBLOCALPATH, (err) => {
    if (err) console.error(`[DB] Error connecting to local database ${process.env.DBLOCALPATH} error message is: ${err.message}`)
    console.log(`[DB] Local database ${process.env.DBLOCALPATH} connected`)
})
const settings = require('./settings.json')
const {
    logout
} = require('./src/functions')

/* 
format:
[{
    guildid: -1,
    reactroles: [{
        roleid: -1,
        emoji: ""
    }]
}]
*/
let temp


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
                        logout(bot)
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

                    })

                    // console.log(message.content)
                    // message.react(args[2])




                    break;
                case 'finalize':
                    db.get("select * from reactchannelid where guildid = " + message.guild.id, (err, row) => {
                        if (err) return console.error(`[DB] ${err.message}`)

                        if (row == undefined) {
                            // there isnt a thing in the db
                            message.reply(`This server dosent have a react role channel setup please use ${settings.prefix}setreactchannel to set one up`)
                        } else {
                            // theres a record in the db

                        }

                    })

                    break;
            }
        }

    }
})


bot.login(process.env.TOKEN)
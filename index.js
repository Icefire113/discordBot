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

bot.on('message', (message) => {
    let args = message.content.slice(settings.prefix.length).split(/ +/)
    if (!message.author.bot || message.content.startsWith(settings.prefix)) {
        switch (args[0].toLowerCase()) {
            case 'setreactchannel':
                // See if server already has a react channel
                db.get(`select * from reactchannelid where guildid = ${message.guild.id}`, (err, row) => {
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
                    db.prepare("drop table if exists reactroles", (err) => {
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
                            \"guildid\"	TEXT NOT NULL UNIQUE,
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
                message.mentions.roles.toJSON().forEach((e) => {
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
                let index = reactrolesdatacache.findIndex(({
                    guildid
                }) => guildid == message.guild.id)
                if (!reactrolesdatacache[index]) {
                    return message.reply(`You havent added roles to finalize use ${settings.prefix}addrole <@role> <emoji> to add them`)
                }


                db.get(`select * from reactchannelid where guildid = ${message.guild.id}`, (err, row) => {
                    if (err) return console.error(`[DB] ${err.message}`)

                    if (row == undefined) {
                        // server dosent have a react role channel set up
                        return message.reply(`This server dosent have a react role channel setup please use ${settings.prefix}setreactchannel to set one up`)
                    } else {
                        // server already has a react role channel setup
                        // check if server already has data in the db
                        db.get(`select * from reactroles where guildid = ${message.guild.id}`, (err, row) => {
                            if (err) return console.error(`[DB] ${err.message}`)

                            if (row == undefined) {
                                // server dosent have a record (data) already in the database
                                db.prepare(`insert into reactroles values (null, ?, ?)`, (err) => {
                                    if (err) {
                                        message.reply('Error adding roles to database')
                                        return console.error(`[DB] ${err.message}`)
                                    }

                                }).run([message.guild.id, JSON.stringify(reactrolesdatacache[index].reactroles)]).finalize()

                                // clear data from cache
                                reactrolesdatacache.splice(index, 1)

                                // add react roles to channel with reactions
                                db.get(`select * from reactchannelid where guildid = ${message.channel.id}`, (err, row) => {
                                    if (err) return console.error(`[DB] ${err.message}`)
                                    if (row == undefined) {
                                        return message.reply("An error occurred please start over")
                                    }
                                    let channelid = row.channelid


                                    db.get(`select * from reactroles where guildid = ${message.guild.id}`, (err2, row2) => {
                                        if (err) return console.error(`[DB] ${err2.message}`)
                                        let roles = JSON.parse(row2.roleids)


                                        let embed = new Discord.MessageEmbed()
                                            .setColor('#e42643')
                                            .setTitle('React Roles!')
                                            .setDescription(() => {
                                                return `Chose a role by reacting to this message\n\n`
                                            });

                                        let MessageEmbed = message.guild.channels.cache.find(channel => channel.id === row.channelid)
                                        // [{"roleid":"873422159471607889","emoji":"🔴"},{"roleid":"873422052596527144","emoji":"🔓"}]
                                        // message.guild.roles.cache.find(role => role.id === row2[0].id)
                                        // message.guild.members.cache.get(message.author.id).roles.add(message.guild.roles.cache.find(role => role.id === '873422159471607889'))
                                    })
                                })



                            } // else {
                            // // server already has a record (data) in the database
                            // let tempdata = JSON.parse(row.roleids).concat(reactrolesdatacache[index].reactroles)

                            // // db.prepare(`replace into reactroles values (null, ?, ?)`, (err) => {
                            // //     if (err) {
                            // //         message.reply('Error adding roles to database')
                            // //         return console.error(`[DB] ${err.message}`)
                            // //     }
                            // // }).run([message.guild.id, JSON.stringify(tempdata)]).finalize()



                            // // clear data from cache
                            // reactrolesdatacache.splice(index, 1)
                            //}
                        })



                    }

                })



                break;
        }
    }
})


bot.login(process.env.TOKEN)
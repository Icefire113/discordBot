function logout(bot) {
    bot.destroy()
    console.log(`[BOT] Logged out`)
}


module.exports = {
    logout
}
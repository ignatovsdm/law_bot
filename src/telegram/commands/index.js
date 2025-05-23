// src/telegram/commands/index.js
const startHandler = require('./startHandler');
const newDialogueHandler = require('./newDialogueHandler');
// const directLeadRequestHandler = require('./directLeadRequestHandler'); // Не регистрируем здесь, вызывается из messages/index.js

function register(bot) {
    startHandler.register(bot);
    newDialogueHandler.register(bot);
    // directLeadRequestHandler.register(bot); // НЕ НУЖНО
}

module.exports = { register };
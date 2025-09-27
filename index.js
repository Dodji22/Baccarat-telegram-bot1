const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

// Serveur Express pour satisfaire Render
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('🤖 Bot Baccarat en ligne!\n\nStatut: Actif 24h/7');
});

app.get('/status', (req, res) => {
    res.json({
        status: 'online',
        uptime: process.uptime(),
        bot: 'Analyseur Baccarat'
    });
});

app.listen(PORT, () => {
    console.log(`🌐 Serveur web démarré sur le port ${PORT}`);
});

// Votre bot Telegram
const token = process.env.BOT_TOKEN;

if (!token) {
    console.error('BOT_TOKEN manquant!');
    process.exit(1);
}

const bot = new TelegramBot(token, {polling: true});

console.log('🤖 Bot Telegram démarré...');

// Toutes vos fonctions existantes...
function extractSuits(cards) {
    return cards.map(card => {
        if (card.includes('♠️')) return '♠️';
        if (card.includes('♣️')) return '♣️';
        if (card.includes('♥️')) return '♥️';
        if (card.includes('♦️')) return '♦️';
        return null;
    }).filter(suit => suit !== null);
}

function parseResult(resultLine) {
    const numMatch = resultLine.match(/#(N\d+)/);
    const cardMatches = resultLine.match(/\(([^()]*)\)/g);
    
    const numero = numMatch ? numMatch[1] : null;
    const playerCards = cardMatches && cardMatches[0] ? 
        cardMatches[0].slice(1, -1).split(/\s+/).filter(card => card) : [];
    const dealerCards = cardMatches && cardMatches[1] ? 
        cardMatches[1].slice(1, -1).split(/\s+/).filter(card => card) : [];

    return {
        numero: numero,
        player: playerCards,
        dealer: dealerCards,
        dealerSuits: extractSuits(dealerCards),
        playerSuits: extractSuits(playerCards)
    };
}

function countOccurrences(arr) {
    const counter = {};
    for (const item of arr) {
        counter[item] = (counter[item] || 0) + 1;
    }
    return counter;
}

function getMostCommon(counter) {
    let maxCount = 0;
    let mostCommon = null;
    
    for (const [item, count] of Object.entries(counter)) {
        if (count > maxCount) {
            maxCount = count;
            mostCommon = item;
        }
    }
    
    return [mostCommon, maxCount];
}

function analyzeForTelegram(messageText) {
    try {
        const lines = messageText.split('\n').filter(line => line.trim());
        let specialIndex = -1;
        
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('SPECIAL:')) {
                specialIndex = i;
                break;
            }
        }
        
        if (specialIndex === -1) {
            return 'Format incorrect! Utilisez SPECIAL: pour indiquer le résultat spécial.';
        }
        
        const historicalLines = lines.slice(1, specialIndex);
        const specialLine = lines[specialIndex].replace('SPECIAL:', '').trim();
        
        if (historicalLines.length < 10) {
            return 'Minimum 10 résultats requis. Vous en avez fourni ' + historicalLines.length;
        }
        
        const results = historicalLines.map(line => parseResult(line.trim()));
        const lastResult = parseResult(specialLine);
        const lastDealerSuits = lastResult.dealerSuits;
        
        if (!lastResult.numero) {
            return 'Format du résultat spécial invalide.';
        }
        
        const sameDealerIndices = [];
        for (let i = 0; i < results.length - 1; i++) {
            if (JSON.stringify(results[i].dealerSuits) === JSON.stringify(lastDealerSuits)) {
                sameDealerIndices.push(i);
            }
        }
        
        if (sameDealerIndices.length === 0) {
            return 'Aucun pattern trouvé pour ' + lastDealerSuits.join(' ');
        }
        
        const nextDealerSuits = [];
        for (const idx of sameDealerIndices) {
            if (idx + 1 < results.length) {
                const nextGameSuits = results[idx + 1].dealerSuits;
                nextDealerSuits.push(...nextGameSuits);
            }
        }
        
        if (nextDealerSuits.length === 0) {
            return 'Aucune donnée trouvée après les matchs.';
        }
        
        const counter = countOccurrences(nextDealerSuits);
        const [mostCommonSuit, count] = getMostCommon(counter);
        const percentage = Math.round(count/nextDealerSuits.length*100);
        
        let response = '✅ PRÉDICTION TROUVÉE!\n\n';
        response += '🎯 Au jeu ' + lastResult.numero + '+1:\n';
        response += '🃏 Couleur prédite: ' + mostCommonSuit + '\n';
        response += '📈 Confiance: ' + percentage + '%\n\n';
        response += '📊 Analysé: ' + historicalLines.length + ' résultats\n';
        response += '✨ Matchs trouvés: ' + sameDealerIndices.length;
        
        return response;
        
    } catch (error) {
        return 'Erreur: ' + error.message;
    }
}

// Commandes du bot
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const name = msg.from.first_name || 'Ami';
    
    bot.sendMessage(chatId, '🎲 Salut ' + name + '! Je suis votre Bot Analyseur Baccarat!\n\n📝 Utilisez /analyze suivi de vos données.\n🧪 Tapez /test pour une démonstration.');
    console.log('✅ ' + name + ' a démarré le bot');
});

bot.onText(/\/analyze/, (msg) => {
    const chatId = msg.chat.id;
    const name = msg.from.first_name || 'Utilisateur';
    
    console.log('🔍 Analyse demandée par ' + name);
    const result = analyzeForTelegram(msg.text);
    bot.sendMessage(chatId, result);
});

bot.onText(/\/test/, (msg) => {
    const chatId = msg.chat.id;
    
    const testMessage = '/analyze\n#N501 (5♣️ K♠️) (4♦️ A♠️)\n#N502 (7♥️ 2♠️) (9♠️ J♦️)\n#N503 (A♥️ 6♦️) (K♠️ 2♣️)\n#N504 (9♣️ 5♠️) (7♥️ Q♦️)\n#N505 (J♠️ 8♦️) (3♣️ K♥️)\n#N506 (2♥️ A♣️) (4♦️ A♠️)\n#N507 (Q♦️ 6♠️) (8♥️ 5♣️)\n#N508 (K♣️ 4♥️) (J♦️ 7♠️)\n#N509 (3♠️ 9♦️) (2♣️ Q♥️)\n#N510 (A♦️ 8♣️) (6♠️ K♥️)\nSPECIAL: #N511 (K♦️ 2♣️) (4♦️ A♠️)';
    
    const result = analyzeForTelegram(testMessage);
    bot.sendMessage(chatId, '🧪 DÉMONSTRATION:\n\n' + result);
});

bot.on('error', (error) => {
    console.log('❌ Erreur bot:', error);
});

// Heartbeat pour maintenir le bot en vie
setInterval(() => {
    console.log('💓 Bot actif - ' + new Date().toLocaleString());
}, 300000); // Toutes les 5 minutes

console.log('✅ Bot Telegram Analyseur Baccarat prêt!');

const { Telegraf, Markup } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);
const GROUP_ID = process.env.GROUP_ID;

// ВНИМАНИЕ: На Vercel этот Map будет очищаться! 
// Для серьезной работы нужна база данных (MongoDB или Supabase).
const leads = new Map();

bot.on('text', async (ctx) => {
    if (ctx.chat.type === 'private') {
        const message = ctx.message.text;
        if (!message.includes('|')) return ctx.reply('Формат: Описание | Номер');
        
        const [desc, phone] = message.split('|').map(s => s.trim());
        const id = Date.now().toString();
        leads.set(id, { desc, phone, status: 'open' });

        await bot.telegram.sendMessage(GROUP_ID, `🔔 НОВАЯ ЗАЯВКА:\n📝 ${desc}`, 
            Markup.inlineKeyboard([[Markup.button.callback('🔓 Узнать номер', `take_${id}`)]])
        );
        ctx.reply('✅ Опубликовано!');
    }
});

// Экспорт для Vercel (Webhook режим)
module.exports = async (req, res) => {
    try {
        if (req.method === 'POST') {
            await bot.handleUpdate(req.body);
        }
        res.status(200).send('OK');
    } catch (e) {
        console.error(e);
        res.status(500).send('Error');
    }
};
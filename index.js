const { Telegraf, Markup } = require('telegraf');
const http = require('http');

// Настройки (лучше использовать переменные окружения на хостинге)
const BOT_TOKEN = process.env.BOT_TOKEN || '7722765669:AAHlpwvbz1TeYwV_s2VDQ6HR8zuwWVggr5M';
const GROUP_ID = process.env.GROUP_ID || '-1003506311009';

const bot = new Telegraf(BOT_TOKEN);
const leads = new Map(); // Память для заявок

// МИНИ-СЕРВЕР (чтобы Koyeb/Render/Railway видели активный процесс)
http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Bot is running');
}).listen(process.env.PORT || 8080);

// Логика приема заявок в личке
bot.on('text', async (ctx) => {
    if (ctx.chat.type === 'private') {
        const message = ctx.message.text;
        if (!message.includes('|')) {
            return ctx.reply('❌ Ошибка! Формат сообщения:\n\nОписание | Номер\n\nПример: Нужен номер на двоих | +996555123456');
        }

        const [desc, phone] = message.split('|').map(s => s.trim());
        const leadId = Date.now().toString();

        leads.set(leadId, { desc, phone, status: 'open' });

        try {
            await bot.telegram.sendMessage(GROUP_ID, `🔔 НОВАЯ ЗАЯВКА:\n━━━━━━━━━━━━━\n📝 ${desc}\n━━━━━━━━━━━━━`, 
                Markup.inlineKeyboard([[Markup.button.callback('🔓 Узнать номер', `take_${leadId}`)]])
            );
            ctx.reply('✅ Ваше объявление опубликовано в группе!');
        } catch (e) {
            ctx.reply('❌ Ошибка: бот не админ в группе.');
        }
    }
});

// Кнопка "Узнать номер"
bot.action(/take_(.+)/, async (ctx) => {
    const leadId = ctx.match[1];
    const lead = leads.get(leadId);

    if (!lead) return ctx.answerCbQuery('❌ Заявка устарела.');
    if (lead.status !== 'open') return ctx.answerCbQuery(`❌ Занято @${lead.ownerName}`, { show_alert: true });

    lead.status = 'busy';
    lead.ownerId = ctx.from.id;
    lead.ownerName = ctx.from.username || ctx.from.first_name;

    await ctx.editMessageText(`⏳ Заявку "${lead.desc}" рассматривает @${lead.ownerName}`, 
        Markup.inlineKeyboard([
            [Markup.button.callback('✅ Договорился', `done_${leadId}`)],
            [Markup.button.callback('❌ Отказ', `cancel_${leadId}`)]
        ])
    );

    try {
        await bot.telegram.sendMessage(ctx.from.id, `📞 КОНТАКТ:\n\nЗаявка: ${lead.desc}\nНомер: ${lead.phone}`);
        ctx.answerCbQuery();
    } catch (e) {
        ctx.answerCbQuery('⚠️ Нажмите START в личке бота!', { show_alert: true });
    }
});

// Кнопки Отказ/Готово
bot.action(/cancel_(.+)/, async (ctx) => {
    const leadId = ctx.match[1];
    const lead = leads.get(leadId);
    if (!lead || lead.ownerId !== ctx.from.id) return ctx.answerCbQuery('Не ваша заявка');
    lead.status = 'open';
    await ctx.editMessageText(`🔔 НОВАЯ ЗАЯВКА (СВОБОДНА):\n📝 ${lead.desc}`, 
        Markup.inlineKeyboard([[Markup.button.callback('🔓 Узнать номер', `take_${leadId}`)]])
    );
});

bot.action(/done_(.+)/, async (ctx) => {
    const leadId = ctx.match[1];
    const lead = leads.get(leadId);
    if (!lead || lead.ownerId !== ctx.from.id) return ctx.answerCbQuery('Не ваша заявка');
    await ctx.editMessageText(`✅ Заявка "${lead.desc}" закрыта отелем @${lead.ownerName}`);
});

bot.launch();
console.log('🚀 Бот запущен!');
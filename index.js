require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const http = require('http');

// 1. Мини-сервер для поддержания жизни на хостинге
http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Bot is running');
}).listen(process.env.PORT || 8080);

// 2. Инициализация бота
const bot = new Telegraf(process.env.BOT_TOKEN);
const GROUP_CHAT_ID = process.env.GROUP_ID;

// Хранилище заявок в оперативной памяти (внимание: очищается при перезагрузке сервера)
const leads = new Map();

// 3. Обработка входящих сообщений (Заявки)
bot.on('text', async (ctx) => {
    if (ctx.chat.type === 'private') {
        const message = ctx.message.text;

        if (!message.includes('|')) {
            return ctx.reply('⚠️ Пожалуйста, используйте формат:\n\nОписание | Номер телефона\n\nПример: Нужен стандарт на двоих | +79001112233');
        }

        const [desc, phone] = message.split('|').map(s => s.trim());
        const leadId = Date.now().toString();

        leads.set(leadId, {
            desc,
            phone,
            status: 'open',
            ownerId: null,
            ownerName: null
        });

        try {
            await bot.telegram.sendMessage(GROUP_CHAT_ID, `🔔 НОВАЯ ЗАЯВКА:\n━━━━━━━━━━━━━\n📝 ${desc}\n━━━━━━━━━━━━━`, 
                Markup.inlineKeyboard([
                    [Markup.button.callback('🔓 Узнать номер', `take_${leadId}`)]
                ])
            );
            ctx.reply('✅ Ваша заявка опубликована в группе!');
        } catch (error) {
            console.error('Ошибка отправки в группу:', error);
            ctx.reply('❌ Ошибка: проверьте, что бот добавлен в группу как администратор.');
        }
    }
});

// 4. Логика кнопки "Узнать номер"
bot.action(/take_(.+)/, async (ctx) => {
    const leadId = ctx.match[1];
    const lead = leads.get(leadId);

    if (!lead) return ctx.answerCbQuery('❌ Заявка слишком старая и была удалена.');

    if (lead.status !== 'open') {
        return ctx.answerCbQuery(`❌ Уже занято @${lead.ownerName}`, { show_alert: true });
    }

    lead.status = 'busy';
    lead.ownerId = ctx.from.id;
    lead.ownerName = ctx.from.username || ctx.from.first_name;

    await ctx.editMessageText(`⏳ Заявку "${lead.desc}" рассматривает @${lead.ownerName}`, 
        Markup.inlineKeyboard([
            [Markup.button.callback('✅ Договорился', `done_${leadId}`)],
            [Markup.button.callback('❌ Отказ (вернуть)', `cancel_${leadId}`)]
        ])
    );

    try {
        await bot.telegram.sendMessage(ctx.from.id, `📞 КОНТАКТ КЛИЕНТА:\n\nЗаявка: ${lead.desc}\nНомер: ${lead.phone}`);
        ctx.answerCbQuery();
    } catch (e) {
        ctx.answerCbQuery('⚠️ Сначала нажмите START в личке у бота!', { show_alert: true });
    }
});

// 5. Кнопка "Отказ"
bot.action(/cancel_(.+)/, async (ctx) => {
    const leadId = ctx.match[1];
    const lead = leads.get(leadId);

    if (!lead || lead.ownerId !== ctx.from.id) return ctx.answerCbQuery('Это не ваша заявка!');

    lead.status = 'open';
    lead.ownerId = null;
    lead.ownerName = null;

    await ctx.editMessageText(`🔔 НОВАЯ ЗАЯВКА (СНОВА СВОБОДНА):\n━━━━━━━━━━━━━\n📝 ${lead.desc}\n━━━━━━━━━━━━━`, 
        Markup.inlineKeyboard([
            [Markup.button.callback('🔓 Узнать номер', `take_${leadId}`)]
        ])
    );
});

// 6. Кнопка "Договорился"
bot.action(/done_(.+)/, async (ctx) => {
    const leadId = ctx.match[1];
    const lead = leads.get(leadId);

    if (!lead || lead.ownerId !== ctx.from.id) return ctx.answerCbQuery('Это не ваша заявка!');

    lead.status = 'closed';
    await ctx.editMessageText(`✅ Заявка "${lead.desc}" закрыта.\nКлиент заселен отелем @${lead.ownerName}`);
});

bot.launch().then(() => console.log('🚀 Бот запущен!'));
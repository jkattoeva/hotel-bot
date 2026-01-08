const { Telegraf, Markup } = require('telegraf');
const http = require('http');

// Создаем простой сервер, чтобы хостинг не отключал бота
http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Bot is active');
}).listen(process.env.PORT || 8080);

// Используем переменные из настроек хостинга
const bot = new Telegraf(process.env.BOT_TOKEN);
const GROUP_ID = process.env.GROUP_ID;

// Хранилище заявок в оперативной памяти
const leads = new Map();

bot.start((ctx) => ctx.reply('Привет! Присылай заявку в формате:\n\nОписание | Номер телефона'));

bot.on('text', async (ctx) => {
    if (ctx.chat.type === 'private') {
        const text = ctx.message.text;
        if (!text.includes('|')) {
            return ctx.reply('❌ Ошибка! Используй разделитель "|"\nПример: Нужен люкс на двоих | +996555123456');
        }

        const [desc, phone] = text.split('|').map(s => s.trim());
        const id = Date.now().toString();

        // Сохраняем в память
        leads.set(id, { desc, phone });

        try {
            await bot.telegram.sendMessage(GROUP_ID, `🔔 НОВАЯ ЗАЯВКА:\n📝 ${desc}`, 
                Markup.inlineKeyboard([[Markup.button.callback('🔓 Узнать номер', `take_${id}`)]])
            );
            ctx.reply('✅ Ваша заявка опубликована в группе!');
        } catch (error) {
            ctx.reply('❌ Ошибка: проверьте, что бот добавлен в группу как администратор.');
        }
    }
});

bot.action(/take_(.+)/, async (ctx) => {
    const id = ctx.match[1];
    const lead = leads.get(id);

    if (lead) {
        await ctx.answerCbQuery();
        // Отправляем номер в личку тому, кто нажал кнопку
        await bot.telegram.sendMessage(ctx.from.id, `📞 Контакт по заявке:\n"${lead.desc}"\nНомер: ${lead.phone}`);
    } else {
        await ctx.answerCbQuery('❌ Ошибка: Заявка слишком старая.', { show_alert: true });
    }
});

bot.launch().then(() => console.log('🚀 Бот успешно запущен!'));
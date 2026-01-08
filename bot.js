const { Telegraf, Markup } = require('telegraf');

// Твой токен
const bot = new Telegraf('7722765669:AAHlpwvbz1TeYwV_s2VDQ6HR8zuwWVggr5M');

// Твой ID группы
const GROUP_CHAT_ID = '-1003506311009'; 

// Хранилище заявок в памяти
const leads = new Map();

// 1. Обработка сообщений в ЛИЧКЕ у бота
bot.on('text', async (ctx) => {
    // Проверяем, что пишут именно в личку, а не в группе
    if (ctx.chat.type === 'private') {
        const message = ctx.message.text;

        // Проверяем наличие разделителя "|"
        if (!message.includes('|')) {
            return ctx.reply('Пожалуйста, пришлите заявку в формате:\n\nОписание | Номер телефона\n\nПример: Нужен стандарт на двоих | +79001112233');
        }

        const [desc, phone] = message.split('|').map(s => s.trim());
        const leadId = Date.now().toString(); // Создаем ID на основе времени

        // Сохраняем данные во временную память
        leads.set(leadId, {
            desc,
            phone,
            status: 'open',
            ownerId: null,
            ownerName: null
        });

        // Отправляем сообщение в ГРУППУ
        try {
            await bot.telegram.sendMessage(GROUP_CHAT_ID, `🔔 НОВАЯ ЗАЯВКА:\n━━━━━━━━━━━━━\n📝 ${desc}\n━━━━━━━━━━━━━`, 
                Markup.inlineKeyboard([
                    [Markup.button.callback('🔓 Узнать номер', `take_${leadId}`)]
                ])
            );
            ctx.reply('✅ Ваше объявление опубликовано в группе!');
        } catch (error) {
            console.error('Ошибка отправки в группу:', error);
            ctx.reply('❌ Ошибка: проверьте, что бот добавлен в группу как администратор.');
        }
    }
});

// 2. Обработка нажатия на кнопку "Узнать номер" (в группе)
bot.action(/take_(.+)/, async (ctx) => {
    const leadId = ctx.match[1];
    const lead = leads.get(leadId);

    if (!lead) return ctx.answerCbQuery('Заявка слишком старая и была удалена.');

    if (lead.status !== 'open') {
        return ctx.answerCbQuery(`❌ Уже занято владельцем @${lead.ownerName}`, { show_alert: true });
    }

    // Бронируем за первым нажавшим
    lead.status = 'busy';
    lead.ownerId = ctx.from.id;
    lead.ownerName = ctx.from.username || ctx.from.first_name;

    // Редактируем сообщение в группе
    await ctx.editMessageText(`⏳ Заявку "${lead.desc}" сейчас рассматривает @${lead.ownerName}`, 
        Markup.inlineKeyboard([
            [Markup.button.callback('✅ Договорился', `done_${leadId}`)],
            [Markup.button.callback('❌ Отказ (вернуть в поиск)', `cancel_${leadId}`)]
        ])
    );

    // Отправляем номер в личку нажавшему
    try {
        await bot.telegram.sendMessage(ctx.from.id, `📞 КОНТАКТ КЛИЕНТА:\n\nЗаявка: ${lead.desc}\nНомер: ${lead.phone}`);
        ctx.answerCbQuery();
    } catch (e) {
        ctx.answerCbQuery('Ошибка! Напишите боту в личку (нажмите Start), чтобы он мог прислать вам номер.', { show_alert: true });
    }
});

// 3. Кнопка "Отказ" (возвращает заявку всем)
bot.action(/cancel_(.+)/, async (ctx) => {
    const leadId = ctx.match[1];
    const lead = leads.get(leadId);

    if (lead.ownerId !== ctx.from.id) return ctx.answerCbQuery('Это не ваша заявка!');

    lead.status = 'open';
    lead.ownerId = null;
    lead.ownerName = null;

    await ctx.editMessageText(`🔔 НОВАЯ ЗАЯВКА (СНОВА СВОБОДНА):\n━━━━━━━━━━━━━\n📝 ${lead.desc}\n━━━━━━━━━━━━━`, 
        Markup.inlineKeyboard([
            [Markup.button.callback('🔓 Узнать номер', `take_${leadId}`)]
        ])
    );
});

// 4. Кнопка "Договорился" (закрывает заявку)
bot.action(/done_(.+)/, async (ctx) => {
    const leadId = ctx.match[1];
    const lead = leads.get(leadId);

    if (lead.ownerId !== ctx.from.id) return ctx.answerCbQuery('Это не ваша заявка!');

    lead.status = 'closed';
    await ctx.editMessageText(`✅ Заявка "${lead.desc}" закрыта.\nКлиент заселен отелем @${lead.ownerName}`);
});

bot.launch();
console.log('Бот успешно запущен и готов к работе!');
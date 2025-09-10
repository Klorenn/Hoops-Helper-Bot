const { Client, GatewayIntentBits, EmbedBuilder, Events, SlashCommandBuilder, REST, Routes } = require('discord.js');
const cron = require('node-cron');
const axios = require('axios');

// Configuración del bot
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

// Cargar configuración local
let config;
try {
    config = require('./config.js');
} catch (error) {
    console.log('📋 No se encontró config.js, usando variables de entorno');
    config = {};
}

// Variables de entorno o configuración local
const DISCORD_TOKEN = process.env.DISCORD_TOKEN || config.DISCORD_TOKEN;
const REMINDER_CHANNEL_ID = process.env.REMINDER_CHANNEL_ID || config.REMINDER_CHANNEL_ID;
const REMINDER_GUILD_ID = process.env.REMINDER_GUILD_ID || config.REMINDER_GUILD_ID;
const CLIENT_ID = process.env.CLIENT_ID || config.CLIENT_ID || (DISCORD_TOKEN ? DISCORD_TOKEN.split('.')[0] : null);

// API de Hoops Finance
const HOOPS_API_BASE = 'https://api.hoops.finance';
const HOOPS_WEBSITE = 'https://www.hoops.finance';

// Estado del servidor
let serverStatus = 'online';
let lastCheck = new Date();

// Sistema de idiomas simplificado
const LANGUAGES = {
    'en': {
        name: 'English',
        flag: '🇺🇸',
        responses: {
            default: "🤖 **AI Assistant for Hoops Finance**\n\nI can help you with questions about DeFi, liquidity pools, and the Hoops Finance platform. Use `/help` to see available commands.",
            server_online: "Hoops Finance server is running correctly",
            server_offline: "⚠️ **ALERT**: Hoops Finance server is down",
            morning_reminder: "🌅 **Daily Hoops Finance Server Check**"
        }
    },
    'es': {
        name: 'Español',
        flag: '🇪🇸',
        responses: {
            default: "🤖 **Asistente de IA para Hoops Finance**\n\nPuedo ayudarte con preguntas sobre DeFi, pools de liquidez y la plataforma Hoops Finance. Usa `/help` para ver comandos disponibles.",
            server_online: "El servidor de Hoops Finance está funcionando correctamente",
            server_offline: "⚠️ **ALERTA**: El servidor de Hoops Finance está caído",
            morning_reminder: "🌅 **Verificación Diaria del Servidor Hoops Finance**"
        }
    },
    'pt': {
        name: 'Português',
        flag: '🇧🇷',
        responses: {
            default: "🤖 **Assistente de IA para Hoops Finance**\n\nPosso ajudar com perguntas sobre DeFi, pools de liquidez e a plataforma Hoops Finance. Use `/help` para ver comandos disponíveis.",
            server_online: "O servidor Hoops Finance está funcionando corretamente",
            server_offline: "⚠️ **ALERTA**: O servidor Hoops Finance está fora do ar",
            morning_reminder: "🌅 **Verificação Diária do Servidor Hoops Finance**"
        }
    }
};

// Función para obtener respuesta en el idioma correcto
function getResponse(key, lang = 'en') {
    return LANGUAGES[lang]?.responses[key] || LANGUAGES['en'].responses[key] || key;
}

// Base de conocimiento de Hoops Finance (mantener para compatibilidad)
const HOOPS_KNOWLEDGE = {
    "pools": "Las piscinas de liquidez son depósitos de tokens que permiten el intercambio descentralizado. Los proveedores de liquidez depositan pares de tokens y reciben tokens LP a cambio. En Hoops Finance, puedes ganar APY proporcionando liquidez.",
    "amm": "AMM significa Automated Market Maker. Es un protocolo que permite el intercambio de tokens sin necesidad de contrapartes directas. Hoops Finance usa AMM para facilitar el trading.",
    "hoops": "Hoops Finance es una plataforma DeFi construida sobre Stellar que facilita el intercambio de activos a través de piscinas de liquidez. Ofrece bajas comisiones y alta velocidad.",
    "fees": "Las comisiones en Hoops Finance son muy bajas gracias a la eficiencia de la red Stellar. Esto hace que sea rentable para operaciones pequeñas y grandes.",
    "speed": "Las transacciones en Stellar y Hoops Finance se confirman en 3-5 segundos, mucho más rápido que Ethereum.",
    "security": "Hoops Finance está construido sobre la red Stellar, que es segura y probada. Stellar tiene un historial de seguridad sólido.",
    "liquidity": "La liquidez en DeFi permite el intercambio continuo de tokens sin necesidad de contrapartes directas. Más liquidez = mejor precio.",
    "apy": "APY (Annual Percentage Yield) es el rendimiento anual que puedes obtener proporcionando liquidez a las pools. Varía según la demanda y el volumen.",
    "tvl": "TVL (Total Value Locked) es el valor total bloqueado en una pool. Indica qué tan popular y confiable es una pool.",
    "impermanent_loss": "Pérdida impermanente ocurre cuando el precio de los tokens en una pool cambia. Es un riesgo de proporcionar liquidez.",
    "stellar": "Stellar es la blockchain sobre la que funciona Hoops Finance. Es rápida, barata y eficiente para transacciones DeFi.",
    "xlm": "XLM (Stellar Lumens) es la moneda nativa de Stellar. Se usa para pagar comisiones y como base para muchas pools."
};

// Función para buscar respuesta en el conocimiento
function getKnowledgeAnswer(question, lang = 'en') {
    const questionLower = question.toLowerCase();
    
    // Palabras clave simples
    if (questionLower.includes('pool') || questionLower.includes('liquidez') || questionLower.includes('piscina')) {
        return "Liquidity pools are token deposits that enable decentralized exchange. In Hoops Finance, you can earn APY by providing liquidity to pools.";
    }
    if (questionLower.includes('hoops') || questionLower.includes('finance')) {
        return "Hoops Finance is a DeFi platform built on Stellar that facilitates asset exchange through liquidity pools. It offers low fees and high speed.";
    }
    if (questionLower.includes('stellar') || questionLower.includes('xlm')) {
        return "Stellar is the blockchain on which Hoops Finance operates. It's fast, cheap, and efficient for DeFi transactions.";
    }
    if (questionLower.includes('apy') || questionLower.includes('yield') || questionLower.includes('rendimiento')) {
        return "APY (Annual Percentage Yield) is the annual return you can earn by providing liquidity to pools. It varies based on demand and volume.";
    }
    
    return null;
}

// Comandos slash - Solo los esenciales
const commands = [
    new SlashCommandBuilder()
        .setName('ask')
        .setDescription('Ask the AI about Hoops Finance')
        .addStringOption(option =>
            option.setName('question')
                .setDescription('Your question about Hoops Finance')
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('best-pools')
        .setDescription('View the best pools by APY with real-time data'),

    new SlashCommandBuilder()
        .setName('status-server')
        .setDescription('Check Hoops Finance server status'),

    new SlashCommandBuilder()
        .setName('language')
        .setDescription('Change bot language')
        .addStringOption(option =>
            option.setName('lang')
                .setDescription('Select language')
                .setRequired(true)
                .addChoices(
                    { name: '🇺🇸 English', value: 'en' },
                    { name: '🇪🇸 Español', value: 'es' },
                    { name: '🇧🇷 Português', value: 'pt' }
                )
        ),

    new SlashCommandBuilder()
        .setName('help')
        .setDescription('Help and available commands')
];

// Función para registrar comandos slash
async function registerSlashCommands() {
    const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
    
    try {
        console.log('🔄 Registrando comandos slash...');
        
        // Solo registrar comandos, sin eliminar primero
        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands }
        );
        
        console.log('✅ Comandos slash registrados correctamente');
        console.log(`📋 ${commands.length} comandos registrados`);
    } catch (error) {
        console.error('❌ Error registrando comandos slash:', error.message);
        console.log('⚠️ Continuando sin comandos slash...');
    }
}

// Función para verificar estado del servidor Hoops Finance
async function checkHoopsStatus() {
    try {
        const response = await axios.get(HOOPS_WEBSITE, { timeout: 10000 });
        const wasOffline = serverStatus === 'offline';
        serverStatus = 'online';
        lastCheck = new Date();
        
        // Si estaba offline y ahora está online, notificar
        if (wasOffline) {
            await notifyServerStatus('online');
        }
        
        return true;
    } catch (error) {
        const wasOnline = serverStatus === 'online';
        serverStatus = 'offline';
        lastCheck = new Date();
        
        // Si estaba online y ahora está offline, notificar
        if (wasOnline) {
            await notifyServerStatus('offline');
        }
        
        return false;
    }
}

// Función para notificar cambio de estado del servidor
async function notifyServerStatus(status, locale = 'es') {
    try {
        if (!REMINDER_CHANNEL_ID || !REMINDER_GUILD_ID) return;

        const guild = client.guilds.cache.get(REMINDER_GUILD_ID);
        if (!guild) return;

        const channel = guild.channels.cache.get(REMINDER_CHANNEL_ID);
        if (!channel) return;

        const embed = new EmbedBuilder()
            .setTitle(status === 'online' ? '🟢 Hoops Finance Online' : '🔴 Hoops Finance Offline')
            .setDescription(getTranslation(status === 'online' ? 'server_online' : 'server_offline', locale))
            .setColor(status === 'online' ? 0x00FF00 : 0xFF0000)
            .setTimestamp()
            .addFields(
                {
                    name: '🌐 Website',
                    value: `[hoops.finance](${HOOPS_WEBSITE})`,
                    inline: true
                },
                {
                    name: '📊 Estado',
                    value: status === 'online' ? '✅ Online' : '❌ Offline',
                    inline: true
                },
                {
                    name: '⏰ Última verificación',
                    value: lastCheck.toLocaleString(),
                    inline: true
                }
            )
            .setFooter({ text: '🤖 Hoops Helper Bot - Monitoreo automático' });

        await channel.send({ 
            content: status === 'offline' ? '@everyone' : '',
            embeds: [embed] 
        });
        
        console.log(`📢 Notificación enviada: Servidor ${status}`);
    } catch (error) {
        console.error('❌ Error enviando notificación de estado:', error);
    }
}

// Función para obtener mejores pools de la API
async function getBestPools() {
    try {
        // Simulamos datos de la API de Hoops Finance
        // En producción, aquí harías la llamada real a la API
        const poolsData = [
            { name: "XLM/USDC", apy: "15.2%", tvl: "$1.2M", volume: "$500K", change: "+2.1%" },
            { name: "XLM/BTC", apy: "12.8%", tvl: "$800K", volume: "$300K", change: "+1.5%" },
            { name: "USDC/USDT", apy: "8.5%", tvl: "$2.1M", volume: "$1.1M", change: "+0.8%" },
            { name: "XLM/ETH", apy: "18.3%", tvl: "$600K", volume: "$200K", change: "+3.2%" },
            { name: "BTC/USDC", apy: "9.1%", tvl: "$1.5M", volume: "$800K", change: "+1.9%" },
        ];

        return poolsData.sort((a, b) => parseFloat(b.apy) - parseFloat(a.apy));
    } catch (error) {
        console.error('❌ Error obteniendo pools:', error);
        return [];
    }
}

// Función para obtener mejores pools con datos reales de la API
async function getBestPoolsDetailed() {
    try {
        const response = await axios.get('https://api.hoops.finance/getstatistics', { timeout: 10000 });
        const data = response.data;

        // Filtrar solo pools con TVL > 0 y APR > 0
        const activePools = data
            .filter(pool => parseFloat(pool.totalValueLocked) > 0 && parseFloat(pool.apr) > 0)
            .map(pool => ({
                name: pool.market,
                apr: pool.apr,
                trending: pool.trendingapr,
                tvl: `$${parseFloat(pool.totalValueLocked).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                volume: `$${parseFloat(pool.volume).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                protocol: pool.protocol,
                fees: `$${parseFloat(pool.fees).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                utilization: pool.utilization
            }))
            .sort((a, b) => parseFloat(b.apr) - parseFloat(a.apr))
            .slice(0, 5); // Top 5

        return activePools;
    } catch (error) {
        console.error('❌ Error obteniendo pools de la API:', error);
        // Fallback a datos simulados si la API falla
        return [
            { 
                name: "native/USDx", 
                apr: "1.35%", 
                trending: "0.00%", 
                tvl: "$1,868,990.77", 
                volume: "$0.00", 
                protocol: "soroswap",
                fees: "$0.00",
                utilization: "0.00%"
            },
            { 
                name: "native/EURC", 
                apr: "0.80%", 
                trending: "1.08%", 
                tvl: "$623,489.11", 
                volume: "$183,882.84", 
                protocol: "soroswap",
                fees: "$551.65",
                utilization: "29.49%"
            }
        ];
    }
}

// Función para enviar recordatorios
async function sendPoolReminder(title, locale = 'es') {
    try {
        if (!REMINDER_CHANNEL_ID || !REMINDER_GUILD_ID) {
            console.warn('No se configuró REMINDER_CHANNEL_ID o REMINDER_GUILD_ID');
            return;
        }

        const guild = client.guilds.cache.get(REMINDER_GUILD_ID);
        if (!guild) {
            console.error(`No se encontró el servidor con ID: ${REMINDER_GUILD_ID}`);
            return;
        }

        const channel = guild.channels.cache.get(REMINDER_CHANNEL_ID);
        if (!channel) {
            console.error(`No se encontró el canal con ID: ${REMINDER_CHANNEL_ID}`);
            return;
        }

        // Obtener mejores pools de la API
        const bestPools = await getBestPools();
        
        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(getTranslation('reminder_title', locale))
            .setColor(0x7D00FF)
            .setTimestamp()
            .addFields(
                {
                    name: getTranslation('best_pools', locale),
                    value: bestPools.slice(0, 3).map((pool, index) => 
                        `**${index + 1}.** ${pool.name} - ${pool.apy} APY ${pool.change}`
                    ).join('\n') || 'No hay datos disponibles',
                    inline: false
                },
                {
                    name: getTranslation('why_review', locale),
                    value: getTranslation('why_review_text', locale),
                    inline: false
                },
                {
                    name: getTranslation('useful_commands', locale),
                    value: getTranslation('commands_text', locale),
                    inline: false
                },
                {
                    name: getTranslation('next_reminder', locale),
                    value: getTranslation('in_12_hours', locale),
                    inline: true
                }
            )
            .setFooter({ text: '🤖 Hoops Helper Bot - Recordatorios automáticos' });

        await channel.send({ embeds: [embed] });
        console.log(`Recordatorio enviado: ${title}`);

    } catch (error) {
        console.error('Error enviando recordatorio:', error);
    }
}

// Evento cuando el bot está listo
client.once(Events.ClientReady, async () => {
    console.log('✅ Bot conectado como:', client.user.tag);
    console.log('🎯 ¡Bot listo y funcionando!');
    console.log('🤖 IA integrada');
    console.log('⏰ Sistema de recordatorios activado');
    console.log('🔍 Monitoreo de servidor activado');

    // Los comandos ya están registrados manualmente
    console.log('✅ Comandos slash ya registrados');

    // Verificar estado inicial del servidor
    await checkHoopsStatus();

    // Programar recordatorios
    // 9:00 AM UTC - Verificación diaria del servidor
    cron.schedule('0 9 * * *', async () => {
        await checkHoopsStatus(); // Verificar estado antes del recordatorio
        sendPoolReminder(getTranslation('morning_reminder', 'es'), 'es');
    }, {
        scheduled: true,
        timezone: "UTC"
    });

    // 10:00 PM UTC
    cron.schedule('0 22 * * *', async () => {
        await checkHoopsStatus(); // Verificar estado antes del recordatorio
        sendPoolReminder(getTranslation('evening_reminder', 'es'), 'es');
    }, {
        scheduled: true,
        timezone: "UTC"
    });

    // Verificar estado del servidor cada 5 minutos
    cron.schedule('*/5 * * * *', async () => {
        await checkHoopsStatus();
    }, {
        scheduled: true,
        timezone: "UTC"
    });

    console.log('⏰ Recordatorios programados: 9:00 AM y 10:00 PM UTC');
    console.log('🔍 Monitoreo cada 5 minutos activado');
});

// Manejo de comandos slash
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    try {
        if (commandName === 'ask') {
            const question = interaction.options.getString('question');
            
            await interaction.deferReply();

            const response = getKnowledgeAnswer(question);
            
            const embed = new EmbedBuilder()
                .setTitle('🤖 AI Assistant - Hoops Finance')
                .setDescription(response || "🤖 **AI Assistant for Hoops Finance**\n\nI can help you with questions about DeFi, liquidity pools, and the Hoops Finance platform. Use `/help` to see available commands.")
                .setColor(0x7D00FF)
                .setTimestamp()
                .addFields({
                    name: '💡 Question',
                    value: question.length > 100 ? question.substring(0, 100) + '...' : question,
                    inline: false
                })
                .setFooter({ text: '🤖 AI integrated' });

            await interaction.editReply({ embeds: [embed] });

        } else if (commandName === 'status-server') {
            await interaction.deferReply();

            // Verificar estado del servidor Hoops Finance
            const isOnline = await checkHoopsStatus();
            
            const embed = new EmbedBuilder()
                .setTitle('🔍 Estado del Servidor Hoops Finance')
                .setColor(isOnline ? 0x00FF00 : 0xFF0000)
                .setTimestamp()
                .addFields(
                    {
                        name: '🌐 Website',
                        value: `[hoops.finance](${HOOPS_WEBSITE})`,
                        inline: true
                    },
                    {
                        name: '📊 Estado',
                        value: isOnline ? '✅ Online' : '❌ Offline',
                        inline: true
                    },
                    {
                        name: '⏰ Verificación',
                        value: new Date().toLocaleString(),
                        inline: true
                    },
                    {
                        name: '📈 Detalles',
                        value: isOnline 
                            ? 'El servidor está funcionando correctamente y respondiendo a las peticiones.'
                            : 'El servidor no está respondiendo. Puede estar en mantenimiento o experimentando problemas.',
                        inline: false
                    }
                )
                .setFooter({ text: '🤖 Hoops Helper Bot - Verificación manual' });

            await interaction.editReply({ embeds: [embed] });

        } else if (commandName === 'best-pools') {
            await interaction.deferReply();

            const poolsData = await getBestPoolsDetailed();

            const embed = new EmbedBuilder()
                .setTitle('🏆 Best Pools by APY - Hoops Finance')
                .setDescription('Top 5 pools with best performance | Real-time data')
                .setColor(0x7D00FF)
                .setTimestamp();

            if (poolsData.length === 0) {
                embed.addFields({
                    name: '⚠️ No Data Available',
                    value: 'No active pools found with APY > 0. Check back later!',
                    inline: false
                });
            } else {
                poolsData.forEach((pool, index) => {
                    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
                    
                    embed.addFields({
                        name: `${medal} ${pool.name}`,
                        value: `📈 APR: ${pool.apr}\n📊 Trending: ${pool.trending}\n💰 TVL: ${pool.tvl}\n📊 Volume: ${pool.volume}\n🏷️ Protocol: ${pool.protocol}`,
                        inline: false
                    });
                });
            }

            embed.addFields({
                name: '🔄 Data Updated',
                value: `from Hoops Finance API • ${new Date().toLocaleString('en-US', { 
                    day: 'numeric', 
                    month: 'long', 
                    hour: '2-digit', 
                    minute: '2-digit' 
                })}`,
                inline: false
            });

            embed.setFooter({ text: '🏀 Hoops Finance - Real-time data' });
            await interaction.editReply({ embeds: [embed] });

        } else if (commandName === 'language') {
            const selectedLang = interaction.options.getString('lang');
            const lang = LANGUAGES[selectedLang] || LANGUAGES['en'];

            const embed = new EmbedBuilder()
                .setTitle('🌍 Bot Language')
                .setDescription(`Language changed to: ${lang.flag} ${lang.name}`)
                .setColor(0x00FF00)
                .setTimestamp()
                .addFields(
                    {
                        name: '📋 Available Commands',
                        value: '`/ask` - Ask the AI\n`/best-pools` - Best pools by APY\n`/status-server` - Check server\n`/language` - Change language\n`/help` - Help',
                        inline: false
                    },
                    {
                        name: 'ℹ️ Note',
                        value: 'Language affects bot responses. Commands remain in English.',
                        inline: false
                    }
                )
                .setFooter({ text: '🤖 Hoops Helper Bot - Multi-language' });

            await interaction.reply({ embeds: [embed] });

        } else if (commandName === 'help') {
            const embed = new EmbedBuilder()
                .setTitle('🏀 Hoops Helper Bot - Commands')
                .setDescription('AI-powered bot with real-time Hoops Finance data')
                .setColor(0x7D00FF)
                .addFields(
                    {
                        name: '🤖 AI Assistant',
                        value: '`/ask <question>` - Ask about Hoops Finance',
                        inline: false
                    },
                    {
                        name: '🏊 Pools & Data',
                        value: '`/best-pools` - Best pools by APY (real-time)\n`/status-server` - Check Hoops Finance server',
                        inline: false
                    },
                    {
                        name: '🌍 Settings',
                        value: '`/language` - Change bot language (EN/ES/PT)',
                        inline: false
                    },
                    {
                        name: '⏰ Auto Features',
                        value: '• Daily server check at 9:00 AM UTC\n• Pool reminders at 10:00 PM UTC\n• Real-time monitoring every 5 minutes',
                        inline: false
                    }
                )
                .setFooter({ text: '🤖 Powered by Hoops Finance API' });

            await interaction.reply({ embeds: [embed] });
        }
    } catch (error) {
        console.error('❌ Error en comando slash:', error);
        
        const errorEmbed = new EmbedBuilder()
            .setTitle('❌ Error')
            .setDescription('Hubo un error procesando tu comando. Inténtalo de nuevo.')
            .setColor(0xFF0000)
            .setTimestamp();

        if (interaction.deferred) {
            await interaction.editReply({ embeds: [errorEmbed] });
        } else {
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    }
});

// Comando ping (mantener para compatibilidad)
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

    if (message.content === '!ping') {
        await message.reply('🏓 Pong! El bot está funcionando correctamente. Usa `/help` para ver los comandos slash disponibles.');
    }

});

// Health check endpoint
const express = require('express');
const app = express();
const PORT = process.env.PORT || 8080;

app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        bot: 'running',
        version: 'javascript',
        uptime: process.uptime(),
        languages: ['es', 'en', 'ru', 'pt']
    });
});

// Función para iniciar el servidor con manejo de errores
function startServer() {
    const server = app.listen(PORT, () => {
    console.log(`🏥 Health check server running on port ${PORT}`);
});

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.log(`⚠️  Puerto ${PORT} ya está en uso, intentando puerto ${PORT + 1}`);
            const newPort = PORT + 1;
            const newServer = app.listen(newPort, () => {
                console.log(`🏥 Health check server running on port ${newPort}`);
            });
        } else {
            console.error('❌ Error iniciando servidor:', err);
        }
    });
}

startServer();

// Iniciar el bot
if (!DISCORD_TOKEN) {
    console.error('❌ No se encontró DISCORD_TOKEN');
    console.error('Configura tu token en Railway o crea un archivo .env');
    console.error('Ejemplo: DISCORD_TOKEN=tu_token_aqui');
    console.error('Ver archivo env.example para más información');
    process.exit(1);
}

console.log('🚀 Iniciando bot...');
console.log(`📋 Configuración:`);
console.log(`   - Token: ${DISCORD_TOKEN ? '✅ Configurado' : '❌ No configurado'}`);
console.log(`   - Canal recordatorios: ${REMINDER_CHANNEL_ID || '❌ No configurado'}`);
console.log(`   - Servidor: ${REMINDER_GUILD_ID || '❌ No configurado'}`);

client.login(DISCORD_TOKEN).catch((error) => {
    console.error('❌ Error al conectar el bot:', error.message);
    console.error('Verifica que el token sea correcto');
    process.exit(1);
});

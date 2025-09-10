const { REST, Routes } = require('discord.js');
const { SlashCommandBuilder } = require('discord.js');

// Cargar configuración
let config;
try {
    config = require('./config.js');
} catch (error) {
    console.log('📋 No se encontró config.js, usando variables de entorno');
    config = {};
}

const DISCORD_TOKEN = process.env.DISCORD_TOKEN || config.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID || config.CLIENT_ID || (DISCORD_TOKEN ? DISCORD_TOKEN.split('.')[0] : null);

// Comandos slash
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

async function registerCommands() {
    const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
    
    try {
        console.log('🧹 Limpiando comandos antiguos...');
        
        // Eliminar todos los comandos existentes
        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: [] }
        );
        
        console.log('✅ Comandos antiguos eliminados');
        console.log('🔄 Registrando comandos nuevos...');
        
        // Registrar comandos nuevos
        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands }
        );
        
        console.log('✅ Comandos registrados correctamente');
        console.log('');
        console.log('📋 Comandos activos:');
        commands.forEach(cmd => {
            console.log(`   - /${cmd.name} - ${cmd.description}`);
        });
        console.log('');
        console.log('🌐 API: https://api.hoops.finance/getstatistics');
        console.log('⚡ Datos en tiempo real activados');
        console.log('');
        console.log('✅ ¡Comandos listos! Ahora puedes usar el bot.');
        
    } catch (error) {
        console.error('❌ Error registrando comandos:', error);
        
        if (error.code === 50001) {
            console.log('💡 Solución: Verifica que el bot tenga permisos de aplicación');
        } else if (error.code === 50013) {
            console.log('💡 Solución: El bot no tiene permisos para registrar comandos');
        } else if (error.code === 40001) {
            console.log('💡 Solución: Token inválido o expirado');
        }
    }
}

registerCommands();

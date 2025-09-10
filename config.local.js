// Configuración local para pruebas del bot
// Copia este archivo como config.js y configura tus valores

module.exports = {
    // Token del bot de Discord
    // Obténlo en: https://discord.com/developers/applications
    DISCORD_TOKEN: 'tu_token_de_discord_aqui',
    
    // ID del canal donde se enviarán los recordatorios
    // Habilita el modo desarrollador en Discord para obtener IDs
    REMINDER_CHANNEL_ID: 'id_del_canal_para_recordatorios',
    
    // ID del servidor de Discord
    REMINDER_GUILD_ID: 'id_del_servidor_discord',
    
    // ID de la aplicación (opcional, se puede extraer del token)
    CLIENT_ID: 'tu_client_id_aqui',
    
    // Puerto para el health check (opcional)
    PORT: 8080
};

// Instrucciones de configuración:
// 1. Ve a https://discord.com/developers/applications
// 2. Crea una nueva aplicación o usa una existente
// 3. Ve a "Bot" y crea un bot
// 4. Copia el token y pégalo en DISCORD_TOKEN
// 5. Ve a "General Information" y copia el Application ID en CLIENT_ID
// 6. En Discord, habilita el modo desarrollador (Configuración > Avanzado > Modo desarrollador)
// 7. Haz clic derecho en tu servidor y selecciona "Copiar ID" para REMINDER_GUILD_ID
// 8. Haz clic derecho en el canal donde quieres los recordatorios y selecciona "Copiar ID" para REMINDER_CHANNEL_ID

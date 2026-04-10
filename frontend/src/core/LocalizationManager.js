export class LocalizationManager {
    constructor() {
        this.currentLanguage = 'es'; // Default
        this.translations = {
            'es': {
                'sys_ready_title': 'Sistema En Línea',
                'sys_ready_msg': 'Universe OS se ha inicializado con éxito.',
                'app_launched_title': 'App Iniciada',
                'app_launched_msg': 'Ventana ID "{id}" lista.',
                'welcome_title': 'Centro de Bienvenida',
                'welcome_desc': 'Secuencia de arranque completada. Todos los motores están en línea.',
                'explorer': 'Explorador',
                'settings': 'Ajustes',
                'terminal': 'Terminal',
                'browser': 'Navegador',
                'profile': 'Perfil',
                'btn_test': 'Probar Notificación',
                'btn_ack': 'Aceptar'
            },
            'en': {
                'sys_ready_title': 'System Online',
                'sys_ready_msg': 'Universe OS has successfully initialized.',
                'app_launched_title': 'App Launched',
                'app_launched_msg': 'Window ID "{id}" initialized.',
                'welcome_title': 'Welcome Hub',
                'welcome_desc': 'Boot sequence completed. All engines are online.',
                'explorer': 'Explorer',
                'settings': 'Settings',
                'terminal': 'Terminal',
                'browser': 'Browser',
                'profile': 'Profile',
                'btn_test': 'Test Notification',
                'btn_ack': 'Acknowledge'
            }
        };
    }

    setLanguage(lang) {
        if (this.translations[lang]) {
            this.currentLanguage = lang;
            console.log(`[Localization] Language set to: ${lang}`);
        }
    }

    t(key, params = {}) {
        let text = this.translations[this.currentLanguage][key] || key;
        for (const [pKey, pVal] of Object.entries(params)) {
            text = text.replace(`{${pKey}}`, pVal);
        }
        return text;
    }
}

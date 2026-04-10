export const LULUCommands = [
    // ── Navigation ──────────────────────────────────────────────────────────
    { category: 'nav', name: 'encuadra galaxia',        command: 'encuadra galaxia',        description: 'Vista heroica del universo completo' },
    { category: 'nav', name: 'navegar a terminal',      command: 'navegar a terminal',      description: 'Ir al planeta Terminal (volcánico)' },
    { category: 'nav', name: 'navegar a explorer',      command: 'navegar a explorer',      description: 'Ir al planeta Explorer (desierto)' },
    { category: 'nav', name: 'navegar a gallery',       command: 'navegar a gallery',       description: 'Ir al planeta Gallery (océano)' },
    { category: 'nav', name: 'navegar a database',      command: 'navegar a database',      description: 'Ir al planeta Database (hielo)' },
    { category: 'nav', name: 'navegar a hologram',      command: 'navegar a hologram',      description: 'Ir al planeta Hologram (gigante gaseoso)' },
    { category: 'nav', name: 'navegar a settings',      command: 'navegar a settings',      description: 'Ir al planeta Settings (jungla)' },
    { category: 'nav', name: 'navegar al sol',          command: 'navegar al sol',          description: 'Ir a la estrella central Sol' },
    { category: 'nav', name: 'zoom in',                 command: 'zoom in',                 description: 'Acercar cámara al objetivo' },
    { category: 'nav', name: 'zoom out',                command: 'zoom out',                description: 'Alejar cámara del objetivo' },
    { category: 'nav', name: 'donde estoy',             command: 'donde estoy',             description: 'Posición y zona actual de la cámara' },
    { category: 'nav', name: 'despegar',                command: 'despegar',                description: 'Salir del foco actual al vuelo libre' },
    { category: 'nav', name: 'vuelo libre',             command: 'vuelo libre',             description: 'Activar modo FREE_FLIGHT' },
    { category: 'nav', name: 'modo stelaryi',           command: 'modo stelaryi',           description: 'Activar modo de combate Stelaryi' },

    // ── World Info ───────────────────────────────────────────────────────────
    { category: 'info', name: 'estado del universo',     command: 'estado del universo',     description: 'Resumen kernel, cámara y galaxia' },
    { category: 'info', name: 'lista de planetas',       command: 'lista de planetas',       description: 'Inventario completo del sistema solar' },
    { category: 'info', name: 'clima de terminal',       command: 'clima de terminal',       description: 'Temperatura, atmósfera y gravedad' },
    { category: 'info', name: 'clima de explorer',       command: 'clima de explorer',       description: 'Temperatura, atmósfera y gravedad' },
    { category: 'info', name: 'clima de gallery',        command: 'clima de gallery',        description: 'Temperatura, atmósfera y gravedad' },
    { category: 'info', name: 'clima de database',       command: 'clima de database',       description: 'Temperatura, atmósfera y gravedad' },
    { category: 'info', name: 'clima de hologram',       command: 'clima de hologram',       description: 'Temperatura, atmósfera y gravedad' },
    { category: 'info', name: 'clima de settings',       command: 'clima de settings',       description: 'Temperatura, atmósfera y gravedad' },
    { category: 'info', name: 'rotar galaxia rapido',    command: 'rotar galaxia rapido',    description: 'Acelerar rotación galáctica' },
    { category: 'info', name: 'rotar galaxia lento',     command: 'rotar galaxia lento',     description: 'Lentificar rotación galáctica' },
    { category: 'info', name: 'rotar galaxia normal',    command: 'rotar galaxia normal',    description: 'Resetear velocidad de rotación' },

    // ── Creation ─────────────────────────────────────────────────────────────
    { category: 'create', name: 'crear planeta volcanico', command: 'crear planeta volcanico', description: 'Materializa un mundo volcánico' },
    { category: 'create', name: 'crear planeta oceano',    command: 'crear planeta oceano',    description: 'Materializa un mundo oceánico' },
    { category: 'create', name: 'crear planeta desierto',  command: 'crear planeta desierto',  description: 'Materializa un mundo desértico' },
    { category: 'create', name: 'crear estrella azul',     command: 'crear estrella azul',     description: 'Materializa una estrella emisiva' },
    { category: 'create', name: 'crear nebulosa cyan',     command: 'crear nebulosa cyan',     description: 'Materializa una nebulosa editable' },
    { category: 'create', name: 'crear cumulo estelar',    command: 'crear cumulo estelar',    description: 'Materializa un cúmulo de estrellas' },
    { category: 'create', name: 'crear agujero negro',     command: 'crear agujero negro',     description: 'Materializa un agujero negro con halo' },
    { category: 'create', name: 'esfera',                  command: 'esfera',                  description: 'Esfera primitiva en escena' },
    { category: 'create', name: 'cubo',                    command: 'cubo',                    description: 'Cubo primitivo en escena' },

    // ── Diagnostics / Scan ───────────────────────────────────────────────────
    { category: 'scan', name: 'scan engine',              command: 'LULU.scan()',             description: 'Telemetría y estado global' },
    { category: 'scan', name: 'debug boot',               command: 'LULU.debug_boot()',       description: 'Diagnostica el grafo de arranque' },
    { category: 'scan', name: 'system graph',             command: 'LULU.system_graph()',     description: 'Grafo de dependencias del sistema' },
    { category: 'scan', name: 'mostrar mapa mental',      command: 'mostrar mapa mental',     description: 'Abre el visualizador ontologico de LULU' },
    { category: 'scan', name: 'rendimiento',              command: 'LULU.performance()',      description: 'FPS, draw calls y memoria' },
    { category: 'scan', name: 'inspecciona sistema navigation', command: 'inspecciona sistema navigation', description: 'Detalle de un sistema por nombre' },
    { category: 'scan', name: 'optimize gpu',             command: 'LULU.optimize_gpu()',     description: 'Ajustar perfil visual / rendimiento' },
    { category: 'scan', name: 'inspect render',           command: 'LULU.inspect_render()',   description: 'Inspecciona render pipeline' },

    // ── Docs ─────────────────────────────────────────────────────────────────
    { category: 'docs', name: 'manual',                   command: 'LULU.show_manual()',      description: 'Guía holográfica de navegación' },
    { category: 'docs', name: 'docs galaxia',             command: 'docs galaxia',            description: 'Ruta documental canon galaxy/render/nav' },
    { category: 'docs', name: 'expand engine',            command: 'LULU.expand_engine()',    description: 'Roadmap evolución del motor' },

    // ── Voice ────────────────────────────────────────────────────────────────
    { category: 'voice', name: 'voz activar',             command: 'voz activar',             description: 'Activar síntesis de voz de LULU' },
    { category: 'voice', name: 'voz desactivar',          command: 'voz desactivar',          description: 'Silenciar síntesis de voz' },
];

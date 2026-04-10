function normalizeWisdomText(text = '') {
    return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function freezeEntry(id, entry) {
    return Object.freeze({
        id,
        discipline: entry.discipline,
        title: entry.title,
        nature: entry.nature,
        status: entry.status,
        support: entry.support || '',
        challenge: entry.challenge || '',
        sourceRefs: Object.freeze([...(entry.sourceRefs || [])]),
        aliases: Object.freeze([...(entry.aliases || [])]),
        keywords: Object.freeze([...(entry.keywords || [])]),
    });
}

export const LULU_WISDOM_LIBRARY = Object.freeze([
    freezeEntry('newton_laws', {
        discipline: 'Fisica',
        title: 'Leyes de Newton',
        nature: 'Universal y determinista en casos ideales',
        status: 'Aceptado como aproximacion en sistemas inerciales',
        support: 'Explican cuantitativamente el movimiento y la gravitacion clasica; fueron la base de la mecanica por siglos.',
        challenge: 'Pierden precision cerca de la velocidad de la luz, en escalas cuanticas y frente al electromagnetismo relativista.',
        sourceRefs: ['1-8'],
        aliases: ['newton', 'mecanica clasica', 'leyes del movimiento'],
        keywords: ['gravedad', 'inercia', 'movimiento', 'determinismo'],
    }),
    freezeEntry('quantum_mechanics', {
        discipline: 'Fisica',
        title: 'Mecanica Cuantica',
        nature: 'Probabilista y universal',
        status: 'Aceptado con limites de integracion',
        support: 'Describe con exito el comportamiento subatomico y el papel del azar en la medicion.',
        challenge: 'No se integra de forma limpia con la relatividad general ni con singularidades cosmologicas.',
        sourceRefs: ['4', '9'],
        aliases: ['cuantica', 'mecanica cuantica'],
        keywords: ['probabilidad', 'subatomico', 'medicion'],
    }),
    freezeEntry('general_relativity', {
        discipline: 'Fisica',
        title: 'Relatividad General',
        nature: 'Universal',
        status: 'Aceptado con limites',
        support: 'Es central para cosmologia, gravedad fuerte y descripcion geomtrica del espacio-tiempo.',
        challenge: 'Sigue sin reconciliarse con la mecanica cuantica y no resuelve por si sola el problema de singularidades.',
        sourceRefs: ['4', '9', '10'],
        aliases: ['einstein', 'relatividad', 'relatividad general'],
        keywords: ['espacio-tiempo', 'cosmologia', 'gravedad'],
    }),
    freezeEntry('uncertainty_principle', {
        discipline: 'Fisica',
        title: 'Principio de Incertidumbre de Heisenberg',
        nature: 'Estadistico y limitacion fundamental',
        status: 'Estatus axiomatico',
        support: 'Establece una cota para pares de variables conjugadas y limita la precision simultanea alcanzable.',
        challenge: 'Impide aspirar a una correccion clasica simple del acto de medicion.',
        sourceRefs: ['1'],
        aliases: ['heisenberg', 'incertidumbre'],
        keywords: ['posicion', 'momento', 'medicion'],
    }),
    freezeEntry('universal_gravity', {
        discipline: 'Fisica',
        title: 'Gravedad Universal',
        nature: 'Universal',
        status: 'Aceptado',
        support: 'Ordena orbitales estables y permite integrar matematicamente sistemas gravitacionales clasicos.',
        challenge: 'Necesita relatividad general en campos intensos y en anomalias como el perihelio de Mercurio.',
        sourceRefs: ['8', '11', '12'],
        aliases: ['gravedad universal', 'ley de gravitacion'],
        keywords: ['orbitas', 'masa', 'atraccion'],
    }),
    freezeEntry('conservation_laws', {
        discipline: 'Fisica',
        title: 'Leyes de Conservacion',
        nature: 'Universal',
        status: 'Aceptado',
        support: 'Conectan magnitudes invariantes con las simetrias profundas de la naturaleza.',
        challenge: 'Su aplicacion exige definir bien el sistema y sus condiciones de aislamiento.',
        sourceRefs: ['3', '6', '7'],
        aliases: ['conservacion de energia', 'conservacion'],
        keywords: ['simetria', 'energia', 'momento'],
    }),
    freezeEntry('second_law_thermo', {
        discipline: 'Fisica',
        title: 'Segunda Ley de la Termodinamica',
        nature: 'Universal y estadistica',
        status: 'Aceptado con limites locales',
        support: 'Da direccion al crecimiento de la entropia y a la irreversibilidad macroscopia.',
        challenge: 'Teoremas de fluctuacion y sistemas abiertos matizan su aplicacion local o cosmica.',
        sourceRefs: ['7', '8'],
        aliases: ['entropia', 'segunda ley', 'termodinamica'],
        keywords: ['irreversibilidad', 'calor', 'sistemas abiertos'],
    }),
    freezeEntry('wave_particle_duality', {
        discipline: 'Fisica',
        title: 'Dualidad Onda-Particula',
        nature: 'Complementaria y paradojica',
        status: 'Aceptado',
        support: 'Difraccion y efecto fotoelectrico fuerzan una descripcion dual de la materia y la radiacion.',
        challenge: 'Exige abandonar intuiciones clasicas unificadas sobre la naturaleza del objeto fisico.',
        sourceRefs: ['1'],
        aliases: ['onda particula', 'dualidad'],
        keywords: ['fotones', 'difraccion', 'complementariedad'],
    }),
    freezeEntry('von_neumann', {
        discipline: 'Fisica (Mecanica Cuantica)',
        title: 'Teorema de von Neumann',
        nature: 'Metafisica y universal',
        status: 'Aceptado',
        support: 'Fue interpretado como un obstaculo fuerte a modelos ingenuos de variables ocultas.',
        challenge: 'Su lectura historica fue discutida despues, aunque sigue siendo un nodo filosofico clave.',
        sourceRefs: ['13'],
        aliases: ['von neumann', 'variables ocultas'],
        keywords: ['cuantica', 'logica', 'medicion'],
    }),
    freezeEntry('spin', {
        discipline: 'Fisica (Mecanica Cuantica)',
        title: 'Espin',
        nature: 'Universal',
        status: 'Aceptado',
        support: 'Organiza conservaciones y proyecciones cuanticas observables en sistemas microscopicos.',
        challenge: 'Teoremas como Kochen-Specker complican asignaciones clasicas previas a la medicion.',
        sourceRefs: ['13'],
        aliases: ['spin', 'espin cuantico'],
        keywords: ['kochen specker', 'proyeccion', 'particulas'],
    }),
    freezeEntry('string_theory', {
        discipline: 'Fisica',
        title: 'Teoria M / Teoria de Cuerdas',
        nature: 'Multidimensional y especulativa',
        status: 'En debate / no demostrada',
        support: 'Ofrece un marco matematico de unificacion entre familias teoricas de supercuerdas.',
        challenge: 'Sigue sin respaldo empirico robusto ni predicciones verificadas superiores al Modelo Estandar.',
        sourceRefs: ['8', '9', '14'],
        aliases: ['teoria m', 'cuerdas', 'supercuerdas'],
        keywords: ['unificacion', 'dimensiones extra'],
    }),
    freezeEntry('loop_quantum_gravity', {
        discipline: 'Fisica',
        title: 'Gravedad Cuantica de Lazos',
        nature: 'Especulativa',
        status: 'En debate',
        support: 'Intenta unir relatividad y cuantica sin postular dimensiones extra.',
        challenge: 'Aun no cuenta con evidencia experimental solida.',
        sourceRefs: ['14'],
        aliases: ['lazos', 'gravedad cuantica de lazos'],
        keywords: ['espacio-tiempo cuantizado', 'gravedad cuantica'],
    }),
    freezeEntry('causality', {
        discipline: 'Fisica',
        title: 'Principio de Causalidad',
        nature: 'Universal y determinista',
        status: 'Cuestionado por la mecanica cuantica',
        support: 'Sostiene la intuicion de que presente y pasado ordenan el futuro.',
        challenge: 'Heisenberg y la cuantizacion debilitan la idea de prediccion perfecta desde un presente exacto.',
        sourceRefs: ['1'],
        aliases: ['causalidad', 'principio causal'],
        keywords: ['determinismo', 'prediccion'],
    }),
    freezeEntry('mathematical_universe', {
        discipline: 'Fisica / Cosmologia',
        title: 'Hipotesis del Universo Matematico',
        nature: 'Estructura matematica',
        status: 'Especulativa',
        support: 'Atrae por parsimonia y por eliminar parametros libres conceptualmente.',
        challenge: 'Es dificil mostrar que una estructura matematica agota por completo la realidad observada.',
        sourceRefs: ['15'],
        aliases: ['hum', 'universo matematico'],
        keywords: ['occam', 'estructura', 'realidad'],
    }),
    freezeEntry('natural_law_physics', {
        discipline: 'Ciencias Naturales',
        title: 'Ley Natural en Fisica',
        nature: 'Universal, simple y absoluta en su dominio',
        status: 'Aceptado',
        support: 'Se apoya en observacion repetida y en ecuaciones compactas dentro de un ambito de validez definido.',
        challenge: 'Su universalidad siempre depende del dominio donde no ha sido contradicha.',
        sourceRefs: ['7'],
        aliases: ['ley natural fisica', 'ley fisica'],
        keywords: ['observacion', 'ecuacion', 'dominio de validez'],
    }),
    freezeEntry('natural_selection', {
        discipline: 'Biologia',
        title: 'Seleccion Natural / Evolucion',
        nature: 'Estadistica y proceso historico',
        status: 'Aceptado como teoria central',
        support: 'Explica adaptacion y reproduccion diferencial con base en variacion heredable.',
        challenge: 'Opera con material disponible, contingencia y azar; no es un optimizador perfecto.',
        sourceRefs: ['2', '5', '16-20'],
        aliases: ['seleccion natural', 'evolucion biologica'],
        keywords: ['adaptacion', 'mutacion', 'contingencia'],
    }),
    freezeEntry('central_dogma', {
        discipline: 'Biologia',
        title: 'Dogma Central de la Biologia Molecular',
        nature: 'Flujo de informacion genetica',
        status: 'Reformulado / aproximacion',
        support: 'Describe la via estandar ADN -> ARN -> proteina.',
        challenge: 'La transcriptasa inversa mostro que tambien puede fluir informacion de ARN a ADN.',
        sourceRefs: ['16-19'],
        aliases: ['dogma central', 'adn arn proteina'],
        keywords: ['transcriptasa inversa', 'vih', 'genetica molecular'],
    }),
    freezeEntry('mendel_laws', {
        discipline: 'Biologia',
        title: 'Leyes de Mendel',
        nature: 'Estadistica y aproximacion util',
        status: 'Aceptado',
        support: 'Fundan la genetica clasica mediante segregacion y dominancia.',
        challenge: 'Muchos rasgos son poligenicos y el azar mutacional rompe predicciones simples.',
        sourceRefs: ['2', '5', '6', '17', '19', '21'],
        aliases: ['mendel', 'genetica mendeliana'],
        keywords: ['dominancia', 'segregacion', 'herencia'],
    }),
    freezeEntry('darwin_evolution', {
        discipline: 'Biologia',
        title: 'Teoria de la Evolucion de Darwin',
        nature: 'Inductiva',
        status: 'Aceptado',
        support: 'Integra una gran masa de observaciones y deducciones historicas sobre la vida.',
        challenge: 'Las criticas suelen apuntar a la distancia entre observacion presente y reconstruccion de todo el pasado.',
        sourceRefs: ['13'],
        aliases: ['darwin', 'darwinismo'],
        keywords: ['seleccion natural', 'historia natural'],
    }),
    freezeEntry('chargaff_rules', {
        discipline: 'Biologia',
        title: 'Leyes de Chargaff',
        nature: 'Universal en seres vivos',
        status: 'Aceptado',
        support: 'Las regularidades A=T y G=C guiaron la deduccion de la estructura del ADN.',
        challenge: 'Son reglas composicionales, no una teoria completa del funcionamiento genetico.',
        sourceRefs: ['18', '22'],
        aliases: ['chargaff', 'a=t', 'g=c'],
        keywords: ['adn', 'bases nitrogenadas'],
    }),
    freezeEntry('chromosomal_inheritance', {
        discipline: 'Biologia',
        title: 'Teoria Cromosomica de la Herencia',
        nature: 'Universal en eucariotas',
        status: 'Aceptado',
        support: 'Alinea el comportamiento de genes con la segregacion cromosomica durante meiosis.',
        challenge: 'Su alcance depende del contexto biologico; no sustituye toda la regulacion genetica.',
        sourceRefs: ['19'],
        aliases: ['teoria cromosomica', 'herencia cromosomica'],
        keywords: ['meiosis', 'genes', 'cromosomas'],
    }),
    freezeEntry('dna', {
        discipline: 'Genetica / Biologia',
        title: 'ADN',
        nature: 'Universal en seres vivos',
        status: 'Aceptado',
        support: 'Codifica y duplica informacion biologica esencial en cada celula.',
        challenge: 'Su lectura funcional depende de regulacion, ambiente y organizacion celular.',
        sourceRefs: ['8', '23'],
        aliases: ['adn', 'dna'],
        keywords: ['codigo genetico', 'celula'],
    }),
    freezeEntry('biological_determinism', {
        discipline: 'Biologia / Psicologia / Sociologia',
        title: 'Determinismo Biologico',
        nature: 'Innato y reduccionista',
        status: 'Debatido / cuestionado',
        support: 'Algunos estudios vinculan variantes geneticas con conductas o predisposiciones.',
        challenge: 'Reduce en exceso el fenotipo e ignora ambiente, cultura e historia del desarrollo.',
        sourceRefs: ['16', '17', '19'],
        aliases: ['determinismo biologico'],
        keywords: ['genotipo', 'fenotipo', 'ambiente'],
    }),
    freezeEntry('mechanicism', {
        discipline: 'Biologia',
        title: 'Mecanicismo',
        nature: 'Aproximado y reduccionista',
        status: 'Vision superada',
        support: 'Fue util como fase historica para descomponer funciones del cuerpo.',
        challenge: 'La biologia sistemica desplazo la idea del organismo como simple maquina de engranajes.',
        sourceRefs: ['16'],
        aliases: ['mecanicismo biologico'],
        keywords: ['organismo', 'sistema'],
    }),
    freezeEntry('continental_drift', {
        discipline: 'Biologia (Evolucion) / Geologia',
        title: 'Teoria de la Deriva Continental',
        nature: 'Geologica e historica',
        status: 'Aceptado',
        support: 'Explica distribuciones de organismos que no se entienden por dispersion simple.',
        challenge: 'Requiere integracion con tectonica, paleontologia y biogeografia concreta.',
        sourceRefs: ['17'],
        aliases: ['deriva continental', 'tectonica de placas'],
        keywords: ['biogeografia', 'continentes'],
    }),
    freezeEntry('consciousness', {
        discipline: 'Psicologia / Neurociencia',
        title: 'Consciencia',
        nature: 'Fenomeno biologico y subjetivo',
        status: 'En debate',
        support: 'Puede estudiarse por correlatos neurales y por su valor adaptativo en organismos complejos.',
        challenge: 'No existe acuerdo firme sobre su definicion ni sobre la brecha entre neuronas y experiencia subjetiva.',
        sourceRefs: ['24-29'],
        aliases: ['consciencia', 'conciencia'],
        keywords: ['problema dificil', 'qualia', 'subjetividad'],
    }),
    freezeEntry('global_workspace', {
        discipline: 'Psicologia Cognitiva',
        title: 'Teoria del Espacio Global de Trabajo',
        nature: 'Funcional y de procesamiento',
        status: 'Aceptado',
        support: 'Modela la consciencia como difusion de informacion en un espacio de acceso global.',
        challenge: 'Se critica por ser metaforica y por rozar el problema del homunculo.',
        sourceRefs: ['25'],
        aliases: ['espacio global de trabajo', 'global workspace'],
        keywords: ['procesamiento de informacion', 'atencion'],
    }),
    freezeEntry('multiple_drafts', {
        discipline: 'Psicologia Cognitiva',
        title: 'Teoria de los Borradores Multiples',
        nature: 'Funcional y monista',
        status: 'Aceptado',
        support: 'Ataca modelos dualistas y propone procesos paralelos sin un teatro central.',
        challenge: 'Se le critica por reduccionismo materialista y por no cerrar el problema de integracion.',
        sourceRefs: ['25'],
        aliases: ['borradores multiples', 'multiple drafts'],
        keywords: ['dennett', 'integracion'],
    }),
    freezeEntry('integrated_information', {
        discipline: 'Neurociencia',
        title: 'Teoria de la Informacion Integrada',
        nature: 'Estadistica y de complejidad',
        status: 'En debate',
        support: 'Introduce una medida matematica Phi para cuantificar integracion causal.',
        challenge: 'Se objeta que atribuye consciencia a sistemas demasiado simples y no explica los qualia.',
        sourceRefs: ['25'],
        aliases: ['informacion integrada', 'phi', 'iit'],
        keywords: ['complejidad', 'integracion'],
    }),
    freezeEntry('orch_or', {
        discipline: 'Fisica / Mecanica Cuantica',
        title: 'Reduccion Objetiva Orquestada',
        nature: 'Cuantica y no determinista',
        status: 'En debate / especulativa',
        support: 'Busca vincular indeterminacion cuantica y consciencia o libre albedrio.',
        challenge: 'Se critica por reemplazar un misterio por otro y por su sabor dualista.',
        sourceRefs: ['25'],
        aliases: ['orch or', 'reduccion objetiva orquestada'],
        keywords: ['penrose', 'hameroff', 'libre albedrio'],
    }),
    freezeEntry('naturalistic_dualism', {
        discipline: 'Metafisica / Psicologia',
        title: 'Dualismo Naturalista',
        nature: 'Fundamental',
        status: 'En debate filosofico',
        support: 'Distingue con claridad los problemas faciles de la consciencia del problema dificil.',
        challenge: 'Se le cuestiona por especulativo y por reabrir versiones de dualismo.',
        sourceRefs: ['25', '26'],
        aliases: ['dualismo naturalista'],
        keywords: ['chalmers', 'problema dificil'],
    }),
    freezeEntry('neuroplasticity', {
        discipline: 'Psicologia / Neurologia',
        title: 'Neuroplasticidad',
        nature: 'Dinamico y aproximado',
        status: 'Aceptado',
        support: 'El cerebro cambia fisicamente y refuerza circuitos ante aprendizaje y desafio.',
        challenge: 'Su dinamica concreta depende de edad, contexto y tipo de estimulo.',
        sourceRefs: ['19'],
        aliases: ['neuroplasticidad'],
        keywords: ['aprendizaje', 'cerebro', 'adaptacion'],
    }),
    freezeEntry('natural_logic', {
        discipline: 'Psicologia / Linguistica',
        title: 'Logica Natural y Gramatica Generativa',
        nature: 'Estadistica y probabilistica',
        status: 'En debate',
        support: 'Busca regularidades profundas en la produccion linguistica.',
        challenge: 'Se objeta que el habla real es mas asociativa y estadistica que puramente logica.',
        sourceRefs: ['13'],
        aliases: ['gramatica generativa', 'logica natural'],
        keywords: ['lenguaje', 'probabilidad', 'chomsky'],
    }),
    freezeEntry('axiom_of_choice', {
        discipline: 'Matematicas (Teoria de Conjuntos)',
        title: 'Axioma de Eleccion',
        nature: 'Universal y postulado',
        status: 'Aceptado generalmente',
        support: 'Permite resultados fuertes como el buen orden para conjuntos arbitrarios.',
        challenge: 'Es independiente de ZF y mantiene controversias historicas y filosoficas.',
        sourceRefs: ['30', '31'],
        aliases: ['axioma de eleccion', 'choice', 'ac'],
        keywords: ['bien orden', 'independencia'],
    }),
    freezeEntry('zf_axioms', {
        discipline: 'Matematicas (Teoria de Conjuntos)',
        title: 'Axiomas de Zermelo-Fraenkel',
        nature: 'Universal',
        status: 'Aceptado como estandar',
        support: 'Proveen una base robusta para evitar paradojas del conjunto ingenuo.',
        challenge: 'Su aceptacion no elimina la independencia de muchos enunciados adicionales.',
        sourceRefs: ['30'],
        aliases: ['zf', 'zermelo fraenkel', 'zfc sin choice'],
        keywords: ['fundamentos', 'paradojas'],
    }),
    freezeEntry('continuum_hypothesis', {
        discipline: 'Matematicas (Teoria de Conjuntos)',
        title: 'Hipotesis del Continuo',
        nature: 'Universal en modelos',
        status: 'Independiente de ZFC',
        support: 'Se cumple en universos como L y organiza escalas de cardinalidad.',
        challenge: 'No puede probarse ni refutarse dentro de ZFC.',
        sourceRefs: ['30'],
        aliases: ['hipotesis del continuo', 'ch'],
        keywords: ['cardinalidad', 'continuo', 'independencia'],
    }),
    freezeEntry('constructibility', {
        discipline: 'Matematicas (Teoria de Conjuntos)',
        title: 'Axioma de Constructibilidad (V=L)',
        nature: 'Universal y restrictiva',
        status: 'Consistente, no fundamental',
        support: 'Garantiza AC y GCH en el universo construible.',
        challenge: 'Restringe mucho el universo y choca con ciertos grandes cardinales.',
        sourceRefs: ['30'],
        aliases: ['v=l', 'constructibilidad'],
        keywords: ['universo construible', 'cardinales'],
    }),
    freezeEntry('regularity', {
        discipline: 'Matematicas (Teoria de Conjuntos)',
        title: 'Axioma de Regularidad',
        nature: 'Universal',
        status: 'Aceptado',
        support: 'Ordena el universo de conjuntos en una jerarquia acumulativa limpia.',
        challenge: 'Aporta poco a la matematica ordinaria del dia a dia.',
        sourceRefs: ['30'],
        aliases: ['regularidad', 'fundacion'],
        keywords: ['jerarquia acumulativa'],
    }),
    freezeEntry('naive_comprehension', {
        discipline: 'Matematicas (Teoria de Conjuntos)',
        title: 'Esquema de Comprension Ingenua',
        nature: 'Universal pretendida',
        status: 'Falso / rechazado',
        support: 'Fue intuitivo como idea inicial para formar conjuntos por propiedad.',
        challenge: 'Conduce a contradicciones como la paradoja de Russell.',
        sourceRefs: ['30'],
        aliases: ['comprension ingenua', 'naive comprehension'],
        keywords: ['russell', 'paradoja'],
    }),
    freezeEntry('determinacy', {
        discipline: 'Matematicas (Teoria de Conjuntos)',
        title: 'Axioma de Determinacion',
        nature: 'Universal en contextos como L(R)',
        status: 'Debate / axioma de cardinal',
        support: 'Aporta regularidad fuerte sobre conjuntos de reales y medibilidad.',
        challenge: 'Es incompatible con el axioma de eleccion global.',
        sourceRefs: ['30'],
        aliases: ['axioma de determinacion', 'ad'],
        keywords: ['juegos infinitos', 'reales'],
    }),
    freezeEntry('basic_logic_laws', {
        discipline: 'Logica Matematica',
        title: 'Leyes Logicas Basicas',
        nature: 'Universal',
        status: 'En debate por intuicionismo',
        support: 'Estructuran buena parte de la matematica clasica.',
        challenge: 'El intuicionismo rechaza la universalidad del tercero excluido en dominios infinitos.',
        sourceRefs: ['31'],
        aliases: ['medio excluido', 'leyes logicas'],
        keywords: ['intuicionismo', 'brouwer'],
    }),
    freezeEntry('logical_paradoxes', {
        discipline: 'Logica / Semantica',
        title: 'Paradojas Logicas (Russell, Cantor)',
        nature: 'Contradiccion formal',
        status: 'Genuinas',
        support: 'Obligaron a reconstruir fundamentos con restricciones mas finas.',
        challenge: 'Muestran que conceptos ingenuos pueden colapsar la consistencia formal.',
        sourceRefs: ['31'],
        aliases: ['paradojas logicas', 'russell', 'cantor'],
        keywords: ['contradiccion', 'fundamentos'],
    }),
    freezeEntry('supply_demand', {
        discipline: 'Economia',
        title: 'Ley de la Oferta y la Demanda',
        nature: 'No es una clase natural',
        status: 'En debate',
        support: 'Sirve como esquema heuristico para precios y mercados simples.',
        challenge: 'El comportamiento humano real esta lejos del agente perfectamente racional y reduce su poder predictivo.',
        sourceRefs: ['2'],
        aliases: ['oferta y demanda'],
        keywords: ['mercado', 'precio', 'racionalidad'],
    }),
    freezeEntry('social_generalizations', {
        discipline: 'Ciencias Sociales',
        title: 'Generalizaciones Empiricas',
        nature: 'Estadistica',
        status: 'Limitado / en debate',
        support: 'Permiten capturar regularidades agregadas en poblaciones humanas.',
        challenge: 'La vaguedad de terminos y la falta de casos ideales limita su fuerza nomologica.',
        sourceRefs: ['2'],
        aliases: ['generalizaciones empiricas'],
        keywords: ['estadistica', 'sociedad'],
    }),
    freezeEntry('natural_law_ethics', {
        discipline: 'Filosofia / Etica',
        title: 'Ley Natural',
        nature: 'Universal',
        status: 'Aceptado en ambito etico',
        support: 'Postula una orientacion fundamental hacia el bien y la realizacion humana.',
        challenge: 'No equivale necesariamente a un codigo racionalista rigido e infalible.',
        sourceRefs: ['32'],
        aliases: ['ley natural etica'],
        keywords: ['bien', 'etica', 'normatividad'],
    }),

    // ── RENDERIZADO 3D / GRAFICOS ──────────────────────────────────────────
    freezeEntry('rayleigh_scattering', {
        discipline: 'Fisica / Graficos 3D',
        title: 'Dispersion de Rayleigh',
        nature: 'Fenomeno fisico de optica de ondas',
        status: 'Aceptado',
        support: 'El cielo es azul porque moleculas pequenas dispersan luz de onda corta (ley inmensa de la cuarta potencia de la longitud de onda). Base del raymarching en OMEGA V31 PlanetShaderSystem con 8 pasos.',
        challenge: 'El limbo tangente tiene rutas 10x mas largas que el cenith. Reducir de 16 a 8 pasos recupera 10 a 15 FPS en hardware de gama media.',
        sourceRefs: ['OMEGA-PlanetShaderSystem'],
        aliases: ['rayleigh', 'dispersion rayleigh', 'cielo azul', 'scattering'],
        keywords: ['atmosfera', 'raymarching', 'shader', 'longitud de onda'],
    }),
    freezeEntry('beer_lambert', {
        discipline: 'Fisica / Graficos 3D',
        title: 'Ley de Beer-Lambert',
        nature: 'Universal — atenuacion exponencial de luz en medios',
        status: 'Aceptado',
        support: 'T = exp(-sigma d). Define cuanta luz del terreno PBR sobrevive al cruzar la atmosfera. En OMEGA V31 el alpha del shader = 1.0 - transmitancia con guard alpha > 0.001 para evitar division por cero.',
        challenge: 'Si alpha es cercano a 0 en el vacio, inscatter/alpha genera valores HDR que hacen explotar el Bloom. El guard alpha > 0.001 devuelve color negro en el vacio.',
        sourceRefs: ['OMEGA-PlanetShaderSystem'],
        aliases: ['beer lambert', 'transmitancia', 'atenuacion exponencial'],
        keywords: ['volumen', 'densidad optica', 'blending', 'webgl', 'bloom'],
    }),
    freezeEntry('float32_precision', {
        discipline: 'Matematicas Computacionales',
        title: 'Perdida de Precision Float32',
        nature: 'Limitacion fundamental del hardware GPU',
        status: 'Conocido — mitigado con Floating Origin en OMEGA V31',
        support: 'GPU opera con float32 y solo 7 digitos significativos. A 100000u del origen solo quedan 2 digitos para posiciones relativas, causando shimmering y z-fighting.',
        challenge: 'La unica solucion robusta es el Floating Origin: mantener la camara siempre cerca del origen moviendo el universo.',
        sourceRefs: ['OMEGA-FloatingOriginSystem'],
        aliases: ['float32', 'precision flotante', 'jitter', 'shimmering'],
        keywords: ['gpu', 'coordenadas', 'precision numerica', 'mundos grandes'],
    }),
    freezeEntry('zero_gc_engine', {
        discipline: 'Ingenieria de Software',
        title: 'Zero-GC — Sin Garbage Collection en tiempo real',
        nature: 'Patron de diseño para motores de alto rendimiento',
        status: 'Ley numero 3 del motor OMEGA V31',
        support: 'El GC de JavaScript pausa el hilo principal al liberar memoria. OMEGA V31 usa pools pre-alocados como TerrainChunkPool con 1000 mallas. El linter zero-gc-lint.js verifica compliance automaticamente.',
        challenge: 'Todo vector temporal debe ser pre-declarado en el constructor. Jamas instanciar con new dentro de update(). La disciplina debe mantenerse en cada sistema registrado.',
        sourceRefs: ['OMEGA-UNIVERSE_LAWS', 'OMEGA-TerrainChunkPool'],
        aliases: ['zero gc', 'cero gc', 'pool de objetos', 'zero gc compliance', 'sin new'],
        keywords: ['javascript', 'rendimiento', 'memoria', 'pool', 'buffer'],
    }),
    freezeEntry('floating_origin', {
        discipline: 'Graficos 3D / Fisica de Juegos',
        title: 'Floating Origin',
        nature: 'Tecnica para mundos a escala real sin jitter float32',
        status: 'Implementado en OMEGA V31 — activo solo en modo planetario',
        support: 'Cuando la camara supera 5000u del origen, el universeLayer se desplaza en sentido opuesto regresando la camara al centro. La escena parece moverse pero la camara siempre tiene maxima precision.',
        challenge: 'Debe ejecutarse en fase post-navigation. Si corre antes, el motor detecta el shift y lo corrige inmediatamente creando rubberbanding o hyper-shifting.',
        sourceRefs: ['OMEGA-FloatingOriginSystem', 'OMEGA-UNIVERSE_LAWS'],
        aliases: ['floating origin', 'origen flotante', 'hyper shifting', 'rubberbanding'],
        keywords: ['coordenadas', 'mundos grandes', 'precision', 'shift'],
    }),
    freezeEntry('quadtree_sphere', {
        discipline: 'Graficos 3D / Algoritmos',
        title: 'QuadTree LOD Planetario',
        nature: 'Subdivision adaptiva de malla por distancia camara-nodo',
        status: 'Implementado en OMEGA V31 sobre CubeSphere de 6 caras',
        support: 'Cada cara del planeta es un QuadTree independiente. Los nodos se dividen al acercarse y fusionan al alejarse. La geometria se genera en TerrainWorker via Transferable ArrayBuffer para zero-copy entre threads.',
        challenge: 'Los chunks del pool estan en Layer 1. Sin Layer isolation, computeBoundingSphere sobre buffers vacios devuelve NaN y el RaycastSelectionSystem crashea 60 veces por segundo.',
        sourceRefs: ['OMEGA-QuadTreeSphere', 'OMEGA-TerrainChunkPool'],
        aliases: ['quadtree', 'lod terreno', 'cubo esfera', 'terrain pool', 'terrain chunk'],
        keywords: ['subdivision', 'worker', 'mesh', 'planeta', 'chunk', 'layer'],
    }),
    freezeEntry('bootgraph_omega', {
        discipline: 'Ingenieria de Software',
        title: 'BootGraph OMEGA — Arranque Determinista en 7 Fases',
        nature: 'Grafo de dependencias para inicializacion segura',
        status: 'Implementado en OMEGA V31',
        support: 'Fases: CORE entonces RENDERING entonces SIMULATION entonces PHYSICS entonces NAVIGATION entonces UI entonces POST. Registry.freeze() al final impide inyecciones tardias.',
        challenge: 'Todo sistema que acceda al Registry fuera de su fase causa ReferenceError (Kernel Panic). El PHASE_ORDER del FrameScheduler es ley inmutable.',
        sourceRefs: ['OMEGA-UniverseKernel', 'OMEGA-ServiceRegistry'],
        aliases: ['bootgraph', 'secuencia boot', 'kernel panic', 'boot sequence', 'registry freeze'],
        keywords: ['inicializacion', 'dependencias', 'freeze', 'phase order', 'kernel'],
    }),

    // ── MECANICA ORBITAL ───────────────────────────────────────────────────
    freezeEntry('kepler_laws', {
        discipline: 'Fisica / Astronomia',
        title: 'Leyes de Kepler',
        nature: 'Descripcion matematica de orbitas elipticas',
        status: 'Aceptado',
        support: 'Primera ley: orbitas son elipses. Segunda ley: areas iguales en tiempos iguales. Tercera ley: el cuadrado del periodo es proporcional al cubo del semieje mayor. Base de OrbitalMechanicsSystem.',
        challenge: 'Solo exacto para dos cuerpos ideales. Perturbaciones de otros planetas requieren integracion numerica RK4.',
        sourceRefs: ['OMEGA-OrbitalMechanicsSystem'],
        aliases: ['kepler', 'orbitas elipticas', 'leyes de kepler', 'periodo orbital'],
        keywords: ['elipse', 'semieje mayor', 'excentricidad', 'orbita gravitacional'],
    }),
    freezeEntry('hohmann_transfer', {
        discipline: 'Fisica / Ingenieria Espacial',
        title: 'Transferencia de Hohmann',
        nature: 'Maniobra orbital de minima energia',
        status: 'Estandar en viajes interplanetarios',
        support: 'Dos quemados: el primero eleva la apoapsida al radio objetivo y el segundo circulariza. Minimo delta-v para orbitas coplanares. MacroWarpSystem usa este principio.',
        challenge: 'Solo funciona entre orbitas coplanares. Cambios de inclinacion orbital son extremadamente costosos en delta-v.',
        sourceRefs: ['OMEGA-MacroWarpSystem'],
        aliases: ['hohmann', 'transferencia de orbita', 'delta v minimo'],
        keywords: ['delta v', 'orbita', 'warp', 'interplanetario'],
    }),

    // ── ASTROFISICA ────────────────────────────────────────────────────────
    freezeEntry('stellar_classification', {
        discipline: 'Astronomia / Astrofisica',
        title: 'Clasificacion Espectral Estelar OBAFGKM',
        nature: 'Sistema de clasificacion por temperatura y color',
        status: 'Aceptado — estandar de la IAU',
        support: 'O mayor de 30000K azul, B, A, F, G Sol G2V amarillo, K, M menor de 3500K roja. OMEGA V31 usa esta distribucion en CosmicBackgroundSystem para 18000 estrellas de fondo con tamaños y brillos calibrados.',
        challenge: 'Tipo O son esplendorosas pero viven solo 1 a 10 millones de años. Tipo M son las mas abundantes al 70 por ciento de la galaxia pero invisibles a simple vista.',
        sourceRefs: ['OMEGA-CosmicBackgroundSystem', 'OMEGA-GalaxyGenerator'],
        aliases: ['obafgkm', 'tipo espectral', 'clasificacion estelar', 'clase g', 'tipo m'],
        keywords: ['temperatura estelar', 'color estrella', 'luminosidad', 'espectro'],
    }),
    freezeEntry('hertzsprung_russell', {
        discipline: 'Astronomia / Astrofisica',
        title: 'Diagrama de Hertzsprung-Russell',
        nature: 'Mapa de la evolucion estelar: luminosidad vs temperatura',
        status: 'Aceptado',
        support: 'La Secuencia Principal agrupa estrellas en fusion de hidrogeno. Gigantes rojas y enanas blancas son fases evolutivas posteriores. El Sol permanecera en la Secuencia Principal otros 5000 millones de años.',
        challenge: 'Las estrellas no evolucionan en escala humana. El diagrama se construye de cumulos estelares de distintas edades usando el turnoff point.',
        sourceRefs: ['OMEGA-GalaxyGenerator'],
        aliases: ['diagrama hr', 'hertzsprung russell', 'secuencia principal', 'gigante roja', 'enana blanca'],
        keywords: ['luminosidad', 'temperatura', 'evolucion estelar', 'main sequence'],
    }),
    freezeEntry('dark_matter', {
        discipline: 'Cosmologia',
        title: 'Materia Oscura',
        nature: 'Hipotetica — masa invisible que no interactua electromagneticamente',
        status: 'Inferida — sin confirmacion directa',
        support: 'Las curvas de rotacion galactica planas no se explican con la masa visible. Representa 27 por ciento del contenido energetico del universo y forma halos invisibles alrededor de galaxias.',
        challenge: 'Ningun experimento ha detectado WIMPs ni axiones. MOND o gravedad modificada es alternativa no descartada.',
        sourceRefs: ['OMEGA-GalaxyGenerator'],
        aliases: ['materia oscura', 'dark matter', 'wimps', 'halo oscuro', 'curva de rotacion'],
        keywords: ['galaxia', 'masa invisible', 'cosmologia', 'gravedad'],
    }),
]);

const WISDOM_DISCIPLINE_ORDER = Object.freeze([
    'Fisica',
    'Ciencias Naturales',
    'Biologia',
    'Genetica / Biologia',
    'Psicologia / Neurociencia',
    'Psicologia Cognitiva',
    'Neurociencia',
    'Metafisica / Psicologia',
    'Psicologia / Linguistica',
    'Matematicas (Teoria de Conjuntos)',
    'Logica Matematica',
    'Logica / Semantica',
    'Economia',
    'Ciencias Sociales',
    'Filosofia / Etica',
]);

const WISDOM_STOPWORDS = new Set([
    'que', 'de', 'del', 'la', 'las', 'el', 'los', 'un', 'una', 'y', 'o',
    'a', 'en', 'por', 'para', 'con', 'sin', 'te', 'se', 'lo', 'como',
    'sabes', 'explica', 'explicame', 'comparar', 'comparame', 'sobre',
    'sabiduria', 'conocimiento', 'nodo', 'fuente',
]);

function buildHaystack(entry) {
    return normalizeWisdomText([
        entry.title,
        entry.discipline,
        entry.nature,
        entry.status,
        entry.support,
        entry.challenge,
        ...(entry.aliases || []),
        ...(entry.keywords || []),
    ].join(' '));
}

function scoreWisdomEntry(entry, normalizedQuery, tokens) {
    if (!normalizedQuery) return 0;

    const haystack = buildHaystack(entry);
    let score = 0;

    const normalizedTitle = normalizeWisdomText(entry.title);
    if (normalizedTitle === normalizedQuery) score += 40;
    else if (normalizedTitle.includes(normalizedQuery) || normalizedQuery.includes(normalizedTitle)) score += 20;

    for (const alias of entry.aliases) {
        const normalizedAlias = normalizeWisdomText(alias);
        if (normalizedAlias === normalizedQuery) score += 28;
        else if (normalizedAlias.includes(normalizedQuery) || normalizedQuery.includes(normalizedAlias)) score += 16;
    }

    for (const token of tokens) {
        if (token.length < 3) continue;
        if (normalizedTitle.includes(token)) score += 5;
        if (entry.aliases.some((alias) => normalizeWisdomText(alias).includes(token))) score += 4;
        if (haystack.includes(token)) score += 2;
    }

    if (normalizedQuery.includes(normalizeWisdomText(entry.discipline))) score += 8;
    return score;
}

export function getWisdomDisciplineSummary() {
    return WISDOM_DISCIPLINE_ORDER
        .map((discipline) => {
            const count = LULU_WISDOM_LIBRARY.filter((entry) => entry.discipline === discipline).length;
            return count > 0 ? { discipline, count } : null;
        })
        .filter(Boolean);
}

export function findWisdomEntries(query = '', { limit = 5 } = {}) {
    const normalizedQuery = normalizeWisdomText(query);
    const tokens = normalizedQuery
        .split(/[^a-z0-9]+/)
        .filter((token) => token && !WISDOM_STOPWORDS.has(token));

    const scored = LULU_WISDOM_LIBRARY
        .map((entry) => ({
            ...entry,
            score: scoreWisdomEntry(entry, normalizedQuery, tokens),
        }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));

    return scored.slice(0, limit);
}

export function findWisdomByDiscipline(query = '', { limit = 8 } = {}) {
    const normalizedQuery = normalizeWisdomText(query);
    const discipline = getWisdomDisciplineSummary()
        .find((entry) => normalizedQuery.includes(normalizeWisdomText(entry.discipline)))
        ?.discipline;

    if (!discipline) return [];

    return LULU_WISDOM_LIBRARY
        .filter((entry) => entry.discipline === discipline)
        .slice(0, limit);
}

export function isWisdomQuery(query = '') {
    const normalized = normalizeWisdomText(query);
    if (!normalized) return false;

    return /(sabiduria|conocimiento|que sabes|explica|explicame|compar|teoria|teorema|axioma|principio|ley|consciencia|conciencia|relatividad|cuantica|darwin|mendel|entropia|oferta y demanda|neuroplasticidad|dualismo)/.test(normalized)
        || findWisdomEntries(query, { limit: 1 }).length > 0
        || findWisdomByDiscipline(query, { limit: 1 }).length > 0;
}

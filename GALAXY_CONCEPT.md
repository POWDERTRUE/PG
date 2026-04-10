# POWDER GALAXY — MASTER UNIVERSE GENERATION SPECIFICATION
## OMEGA ENGINE V30 — GALACTIC ARCHITECTURE

Powder Galaxy es una simulación interactiva de una galaxia espiral barrada diseñada para ejecutarse dentro del motor **OMEGA V30**. El objetivo del sistema es representar una galaxia físicamente plausible, inspirada en la estructura de la Vía Láctea, pero optimizada para renderización en tiempo real mediante tecnologías WebGL / Three.js.

El universo debe ser navegable a múltiples escalas, desde la vista galáctica completa hasta sistemas solares individuales, manteniendo coherencia física, visual y estructural en todos los niveles de detalle.

El sistema debe ser determinístico, lo que significa que la distribución de estrellas, nebulosas y estructuras galácticas debe generarse mediante algoritmos matemáticos reproducibles.

---

# ESCALA DEL UNIVERSO

El sistema utiliza una unidad espacial abstracta donde:

1 unidad ≈ 1 parsec aproximado

Dimensiones aproximadas de la galaxia:

radio del núcleo galáctico: 280 unidades  
radio del bulge galáctico: 1200 unidades  
radio del disco galáctico: 5000 unidades  
radio del halo galáctico: 11000 unidades  

El diámetro total aproximado de la galaxia es:

22000 unidades

---

# ESTRUCTURA JERÁRQUICA DEL UNIVERSO

El universo debe organizarse mediante la siguiente jerarquía estructural:


Galaxy
│
├ Halo galáctico
├ Bulge galáctico
├ Barra galáctica central
├ Brazos espirales
├ Cúmulos estelares
├ Nebulosas
└ Sistemas solares


Cada uno de estos componentes tiene propiedades físicas y visuales distintas.

---

# NÚCLEO GALÁCTICO (GALACTIC CORE)

El núcleo galáctico representa la región más densa de la galaxia.

Características principales:

- forma: disco gaussiano extremadamente denso
- radio aproximado: 280 unidades
- altura vertical: 40 unidades
- densidad estelar: extremadamente alta
- número aproximado de estrellas: 12000

Distribución estelar:


density = exp(-(r²)/(2σ²))


Colores predominantes:


#fff5dd
#ffcc88


Tipos estelares dominantes:

- gigantes amarillas
- gigantes rojas

En el centro del núcleo debe existir un **agujero negro supermasivo**, que genera un leve halo gravitacional luminoso.

---

# BULGE GALÁCTICO

El bulge es la región esférica que rodea al núcleo.

Forma:


esfera oblata


Dimensiones aproximadas:


radio horizontal: 1200 unidades
altura vertical: 600 unidades


Distribución de densidad:


density = exp(-radius / scale_length)


Tipos estelares predominantes:

- estrellas tipo K
- estrellas tipo M

Colores dominantes:


#ffcc88
#ff8844


Estas representan poblaciones estelares antiguas.

---

# BARRA GALÁCTICA

La galaxia posee una **barra galáctica central**.

Parámetros:


longitud: 1800 unidades
ancho: 400 unidades
inclinación: 25 grados


La barra galáctica actúa como origen de los brazos espirales.

---

# BRAZOS ESPIRALES

La galaxia contiene **5 brazos espirales principales**.

Offsets angulares:


0°
72°
144°
216°
288°


Modelo matemático:


r = a * e^(bθ)


Parámetros recomendados:


a = 350
b = 0.28


Espesor de brazo:


120 unidades


Colores de estrellas jóvenes:


#88aaff
#88ccff


Regiones externas con estrellas más viejas:


#ff8844


---

# POLVO GALÁCTICO

Entre los brazos espirales deben existir **bandas de polvo galáctico** (dust lanes).

Estas regiones reducen la densidad visible de estrellas y generan contrastes naturales entre brazos brillantes y zonas oscuras.

---

# HALO GALÁCTICO

El halo rodea toda la galaxia.

Forma:


esfera oblata


Relación vertical:


altura = radio * 0.45


Radio:


3000u – 11000u


Número aproximado de estrellas:


12000


Color predominante:


#ff5522


Estas representan **enanas rojas antiguas**.

---

# CÚMULOS GLOBULARES

Cantidad aproximada:


25 cúmulos


Cada cúmulo contiene:


280 estrellas


Color predominante:


#ff8844


Distribución:


órbitas elípticas alrededor del halo


---

# NEBULOSAS

Tipos principales:

| Tipo | Cantidad | Color |
|-----|------|------|
Emisión (HII) | 18 | #ff3355 |
Reflexión | 12 | #3388ff |
Planetaria | 8 | #00ffcc |

Distribución:

- principalmente en brazos espirales

Representación:


volumetric particle clouds


---

# SISTEMA SOLAR DEL OBSERVADOR

El jugador inicia cerca de un sistema solar especial.

Estrella central:


radio: 40u
color: #ffdd88
emissive: 38%


Esta estrella funciona como **ancla del sistema operativo galáctico**.

---

# PLANETAS DEL SISTEMA

El sistema contiene **6 planetas funcionales**.

Cada planeta representa una aplicación.

| Planeta | Clase | Función |
|-------|------|------|
Terminal | volcánico | terminal del sistema |
Explorer | desierto | explorador de archivos |
Gallery | océano | galería |
Database | hielo | base de datos |
Hologram | gigante gaseoso | hologramas |
Settings | jungla | configuración |

Cada planeta debe tener:

- atmósfera
- shader atmosférico
- LOD de superficie

---

# ROTACIÓN GALÁCTICA

La galaxia rota lentamente en tiempo real.


galaxy.rotation.y += 0.000035


Esto produce una rotación completa aproximadamente cada **5 horas reales**.

Clusters y nebulosas rotan sincronizados.

---

# SISTEMA LOD

### FAR (>5000u)

Vista galáctica completa.

### MID (1500–5000u)

Brazos espirales visibles.

### NEAR (500–1500u)

Cúmulos estelares visibles.

### SYSTEM (<100u)

Sistema solar completo.

---

# DINÁMICA ORBITAL

Velocidad orbital aproximada:


v = baseSpeed * (1 / sqrt(radius))


Esto produce una rotación diferencial similar a galaxias reales.

---

# EXPERIENCIA DEL USUARIO

El usuario debe poder:

- ver galaxia completa
- navegar brazos galácticos
- explorar cúmulos
- entrar a sistemas solares
- aterrizar en planetas
- interactuar con aplicaciones
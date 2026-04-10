# 🌌 POWDER GALAXY - LÍNEA TEMPORAL Y CONTROL DE VERSIONES (TIMELINE)

Este documento es el registro oficial ultraligero de la evolución de **Powder Galaxy**. Enumera los hitos desde el prototipo original hasta su visión final como Universo AAA.

---

## 📅 PASADO: El Génesis (Fase Prototipo)
**v0.1.0 - El Big Bang Monolítico**
- Creación de la primera línea de código: Un canvas de Three.js renderizando las primeras esferas flotantes.
- Implementación de `GalaxyGenerator` con órbitas fijas basadas en rotación matemática ("falsa gravedad").
- Sistema de interacciones acoplado: Raycasting, teclado y ratón mezclados en un solo archivo inmanejable.
- Nacimiento de la consola **LULU** (versión básica).

---

## ⚡ PRESENTE: La Arquitectura OMEGA (Fase ECS & AAA)
*El salto de un experimento web a un motor de juego profesional determinista.*

**v1.0.0 - OMEGA V-Final (Actual)**
- **Arquitectura ECS (Entity Component System)**: Desacoplamiento total de dependencias mediante `UniverseKernel`, `ServiceRegistry` y `FrameScheduler`. Cero colisiones lógicas.
- **LULU Evolucionado**: Sistema robusto de procesamiento de comandos en lenguaje natural con su propio manual holográfico incorporado.
- **Renderizado Instanciado & Culling**: El motor ahora procesa **150,000 estrellas procedimentales** iteradas con la Sucesión de Fibonacci matemáticas, filtrando (Frustum Culling) lo que no se ve para preservar 60 FPS fijos.
- **Gravedad Newtoniana (`OrbitalMechanicsSystem`)**: Se erradicó el "giro de pivote". Las estrellas y planetas ahora obedecen la simulación de Gravedad N-Body mediante un integrador de Euler Semi-Implícito. Todo tiene masa y velocidad real.
- **Camara FSM (State Machine)**: Movilidad total "Free Flight" con 6 grados de libertad, "Warping" (viaje a hipervelocidad) y "World Focus" dinámico.
- **Escala Infinita (`FloatingOriginSystem`)**: Prevención de colapso de punto flotante en WebGL trasladando todo el universo dinámicamente de vuelta al origen `[0,0,0]` al alcanzar el espacio profundo.

---

## 🔮 FUTURO: Lo que podrá ser (Fase Expansión)
*La hoja de ruta hacia el MMO Sandbox de exploración.*

**v2.0.0 - Ecosistema y Vida (En Desarrollo / Próximos Pasos)**
- **Generación de Superficies (Planetary Landings)**: LOD dinámico mediante QuadTrees y ruido fractal 3D para permitir descensos sin costuras (seamless) desde la órbita hasta la superficie de cualquier planeta procedural.
- **Atmósferas Rayleigh/Mie**: Dispersión de luz volumétrica (Atmospheric Scattering) calculada por shaders del lado de la GPU, para cielos realistas de acuerdo al gas de cada mundo.
- **Mecánica de Vuelo Estandarizada (Ship Controllers)**: Transición de la cámara de Dios (God View) al control físico desde la cabina de una nave usando inercias, propulsores (thrusters) y colisionadores.

**v3.0.0 - Multiverso Conectado (Network & MMO)**
- **Server Autoridad (Netcode)**: Interpolación y extrapolación para mover cientos de naves de usuarios sin latencia usando WebRTC o UDP (`UniverseSocketClient`).
- **Sistema de Facciones y Economía**: Minería de asteroides instanciados y un registro persistente en base de datos.

**vX.0.0 - OMEGA Absoluto**
- Todo Powder Galaxy operando como un meta-sistema escalable, donde desarrolladores (o los propios jugadores) puedan crear sub-mundos, lógicas y arquitecturas dentro del motor.

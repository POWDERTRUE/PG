/**
 * UniverseEvents.js
 * V8 Canonical Event Registry.
 * Centralizes all event types to ensure architectural consistency.
 */
export const UniverseEvents = {
    // Descubrimiento (V2)
    PLANET_DISCOVERED: 'discovery:planet',
    ENTITY_CREATED: 'entity:created',
    
    // Transiciones Espaciales (V2)
    ENTER_ATMOSPHERE: 'spatial:enter_atmo',
    EXIT_ATMOSPHERE: 'spatial:exit_atmo',
    ENTER_WARP: 'spatial:enter_warp',
    EXIT_WARP: 'spatial:exit_warp',
    
    // Streaming y Datos (V2)
    SECTOR_LOADED: 'streaming:sector_ready',
    SECTOR_UNLOADED: 'streaming:sector_purged',
    
    // Sistema (V2)
    KERNEL_PANIC: 'system:error',
    CORE_READY: 'system:core_ready',

    // Spatial / Engine Events (Legacy/Other)
    PLANET_CLICKED: "PLANET_CLICKED",
    MOON_SELECTED: "MOON_SELECTED",
    GALAXY_READY: "GALAXY_READY",
    
    // OS / Window Management
    WINDOW_OPEN: "WINDOW_OPEN",
    WINDOW_CLOSE: "WINDOW_CLOSE",
    WINDOW_MINIMIZE: "WINDOW_MINIMIZE",
    WINDOW_FOCUS: "WINDOW_FOCUS",

    // Navigation / Input
    NAV_TARGET_SET: "NAV_TARGET_SET",
    UI_ENTER: "UI_ENTER",
    UI_EXIT: "UI_EXIT",

    // Intelligence / Context
    CATEGORY_ENTER: "CATEGORY_ENTER",
    CATEGORY_EXIT: "CATEGORY_EXIT",
    INTELLIGENCE_UPDATE: "INTELLIGENCE_UPDATE",

    // Network / Socket
    NETWORK_CONNECTED: "NETWORK_CONNECTED",
    NETWORK_DISCONNECTED: "NETWORK_DISCONNECTED",
    REMOTE_COMMAND: "REMOTE_COMMAND"
};

export default UniverseEvents;


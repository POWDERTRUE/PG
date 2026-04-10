/**
 * Universe Event Protocol
 * =======================
 * Defines the standard language and structure for
 * all Spatial OS events sent across the WebSocket.
 */

class UniverseEvents {
    // Spatial Movement
    static PLANET_CLICKED = "PLANET_CLICKED";
    static USER_WARPED    = "USER_WARPED";
    
    // OS Apps
    static APP_LAUNCHED   = "APP_LAUNCHED";
    static APP_CLOSED     = "APP_CLOSED";
    
    // Multiuser Sync
    static PLAYER_JOINED  = "PLAYER_JOINED";
    static PLAYER_MOVED   = "PLAYER_MOVED";
    static PLAYER_LEFT    = "PLAYER_LEFT";

    /**
     * Create a standard OS message payload
     */
    static createMessage(type, payload = {}) {
        return JSON.stringify({
            type,
            timestamp: Date.now(),
            payload
        });
    }
}

module.exports = UniverseEvents;

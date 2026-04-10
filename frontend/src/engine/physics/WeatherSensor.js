import * as THREE from 'three';
// registry/events imported via injection

/**
 * WeatherSensor.js - V30 OMEGA
 * 
 * Aggregates atmospheric and environmental data for the HUD and other systems.
 */
export class WeatherSensor {
    constructor() {
        this.currentCondition = 'CLEAR';
        this.windStrength = 0;
        this.visibility = 1.0;
    }

    init() {
        this.events.on('weather:turbulence', (data) => this.updateStatus(data));
        console.log('[WeatherSensor] Environmental Analysis Unit Active.');
    }

    updateStatus({ intensity, density }) {
        this.windStrength = intensity;
        
        if (density > 0.8) {
            this.currentCondition = intensity > 0.4 ? 'STORM' : 'CLOUDY';
        } else if (density > 0.3) {
            this.currentCondition = 'FOGGY';
        } else {
            this.currentCondition = 'CLEAR';
        }

        this.visibility = 1.0 - (density * 0.5);
    }

    getReport() {
        return {
            condition: this.currentCondition,
            wind: (this.windStrength * 100).toFixed(0) + ' km/h',
            visibility: (this.visibility * 100).toFixed(0) + '%'
        };
    }
}



/**
 * GPUCapabilityDetector.js
 * OMEGA V28+ Architecture - Hardware Compatibility Layer
 */
export function detectGPUCapabilities(renderer) {
    if (!renderer) return null;
    
    const gl = renderer.getContext();
    if (!gl) return null;

    const capabilities = {
        maxTextures: gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS),
        maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
        maxVertexUniforms: gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS),
        instancing: !!gl.getExtension('ANGLE_instanced_arrays') || !!gl.getContextAttributes().antialias, // Basic check for WebGL2/Ext
        floatTextures: !!gl.getExtension('OES_texture_float') || !!gl.getExtension('EXT_color_buffer_float'),
        isWebGL2: gl instanceof WebGL2RenderingContext
    };

    // Determine Engine Profile
    let profile = 'low';
    if (capabilities.isWebGL2 && capabilities.maxTextureSize >= 8192 && capabilities.floatTextures) {
        profile = 'high';
    } else if (capabilities.maxTextureSize >= 4096) {
        profile = 'medium';
    }

    return {
        ...capabilities,
        profile
    };
}

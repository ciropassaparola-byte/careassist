/**
 * Native Utilities - Logistica C. Milella
 * Un ponte per le nuove funzionalita' verso Node.js nativo.
 * Usa queste funzioni per bypassare le restrizioni di ActiveX nei nuovi moduli.
 */

var NativeUtils = (function() {
    var fs = null;
    var path = null;
    
    if (typeof require !== 'undefined') {
        try {
            fs = require('fs');
            path = require('path');
        } catch(e) {
            console.warn("NativeUtils: require fallito, l'ambiente Node non e' disponibile.", e);
        }
    }

    return {
        /**
         * Legge un file in modalita' sincrona.
         */
        ReadFileString: function(filePath, encoding) {
            if (!fs) return null;
            try {
                return fs.readFileSync(filePath, encoding || 'utf8');
            } catch(e) {
                console.error("NativeUtils Read Error: ", e);
                return null;
            }
        },

        /**
         * Scrive un file in modalita' sincrona.
         */
        WriteFileString: function(filePath, content, encoding) {
            if (!fs) return false;
            try {
                fs.writeFileSync(filePath, content, encoding || 'utf8');
                return true;
            } catch(e) {
                console.error("NativeUtils Write Error: ", e);
                return false;
            }
        },
        
        /**
         * Controlla l'esistenza di un file o cartella.
         */
        Exists: function(filePath) {
            if (!fs) return false;
            try {
                return fs.existsSync(filePath);
            } catch(e) {
                return false;
            }
        },
        
        /**
         * Unisce i percorsi in modo sicuro, risolvendo slash e backslash.
         */
        JoinPath: function() {
            if (!path) {
                // Fallback semplice
                return Array.prototype.slice.call(arguments).join("\\").replace(/\\+/g, "\\");
            }
            return path.join.apply(path, arguments);
        }
    };
})();

// Esponi globalmente
if (typeof window !== 'undefined') {
    window.NativeUtils = NativeUtils;
}

// GLOBAL CONTEXT MENU
(function() {
    // Evita doppia iniezione
    if(window.GlobalContextMenuLoaded) return;
    window.GlobalContextMenuLoaded = true;

    // Inietta CSS e Script Toast se non presenti
    if(!document.getElementById('toastManagerScript')) {
        var tCss = document.createElement('link');
        tCss.rel = 'stylesheet';
        tCss.href = 'assets/css/toast.css';
        document.head.appendChild(tCss);
        
        var tJs = document.createElement('script');
        tJs.id = 'toastManagerScript';
        tJs.src = 'assets/js/toast_manager.js';
        document.head.appendChild(tJs);
    }
    
    // Inietta Spotlight Script
    if(!document.getElementById('spotlightScript')) {
        var sJs = document.createElement('script');
        sJs.id = 'spotlightScript';
        sJs.src = 'assets/js/spotlight.js';
        document.head.appendChild(sJs);
    }
    
    // Override alert globally per usare Toast
    var originalAlert = window.alert;
    window.alert = function(msg) {
        if (typeof ToastManager !== 'undefined') {
            msg = String(msg);
            var mLower = msg.toLowerCase();
            if (mLower.indexOf("errore") !== -1 || mLower.indexOf("impossibile") !== -1 || mLower.indexOf("manca") !== -1) {
                ToastManager.error(msg, 5000);
            } else if (mLower.indexOf("successo") !== -1 || mLower.indexOf("completat") !== -1 || mLower.indexOf("correttamente") !== -1 || mLower.indexOf("aggiunto") !== -1 || mLower.indexOf("eliminat") !== -1) {
                ToastManager.success(msg, 4000);
            } else if (mLower.indexOf("attenzione") !== -1 || mLower.indexOf("seleziona prima") !== -1) {
                ToastManager.warning(msg, 4000);
            } else {
                ToastManager.info(msg, 4000);
            }
        } else {
            originalAlert(msg);
        }
    };

    // Inietta CSS
    var style = document.createElement('style');
    style.innerHTML = "" +
    "#globalContextMenu {" +
    "    display: none; position: fixed; z-index: 100000; width: 220px;" +
    "    background: rgba(15, 23, 42, 0.85); filter: progid:DXImageTransform.Microsoft.gradient(startColorstr=#D80F172A,endColorstr=#D80F172A);" +
    "    border: 1px solid rgba(212, 175, 55, 0.3); border-radius: 12px;" +
    "    box-shadow: 0 10px 30px rgba(0,0,0,0.7); padding: 8px 0;" +
    "    font-family: 'Segoe UI', Arial, sans-serif;" +
    "}" +
    ".g-ctx-item {" +
    "    padding: 10px 16px; color: #e2e8f0; font-size: 13px; font-weight: 600;" +
    "    cursor: pointer; transition: all 0.2s; display: block;" +
    "}" +
    ".g-ctx-item:hover {" +
    "    background: rgba(212, 175, 55, 0.2); color: #d4af37; padding-left: 20px;" +
    "}" +
    ".g-ctx-sep {" +
    "    height: 1px; background: rgba(255,255,255,0.08); margin: 6px 0;" +
    "}" +
    "#globalQuickDrawer {" +
    "    position: fixed; top: 0; right: -320px; width: 320px; height: 100%;" +
    "    background: rgb(10, 11, 16); border-left: 1px solid rgba(212, 175, 55, 0.4);" +
    "    box-shadow: -5px 0 30px rgba(0,0,0,0.8); z-index: 100001;" +
    "    transition: right 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);" +
    "    font-family: 'Segoe UI', Arial;" +
    "}";
    document.head.appendChild(style);

    // Inietta HTML
    var menuHTML = "" +
    "<div id='globalContextMenu'>" +
    "    <div class='g-ctx-item' onclick='location.reload()'>🔄 Aggiorna Finestra</div>" +
    "    <div class='g-ctx-item' onclick='window.GlobalPrint()'>🖨️ Stampa</div>" +
    "    <div class='g-ctx-sep'></div>" +
    "    <div class='g-ctx-item' onclick='window.ToggleGlobalDrawer()'>📝 Blocco Note Veloce</div>" +
    "    <div class='g-ctx-sep'></div>" +
    "    <div class='g-ctx-item' onclick='window.close()' style='color: #ef4444;'>❌ Chiudi Finestra</div>" +
    "</div>" +
    "<div id='globalQuickDrawer'>" +
    "    <div style='padding: 15px; border-bottom: 1px solid rgba(212, 175, 55, 0.2);'>" +
    "        <span style='color: #d4af37; margin: 0; font-size: 15px; font-weight: bold;'>📝 Appunti Veloci</span>" +
    "        <span onclick='ToggleGlobalDrawer()' style='color: white; cursor: pointer; font-size: 20px; float: right; margin-top:-5px;'>&times;</span>" +
    "    </div>" +
    "    <div style='padding: 15px; height: 90%;'>" +
    "        <textarea id='globalQuickNotesArea' placeholder='Scrivi qui... (Si auto-salva)' style='width: 100%; height: 100%; background: transparent; border: none; color: #38bdf8; font-family: Consolas, monospace; font-size: 14px; outline: none;'></textarea>" +
    "    </div>" +
    "</div>";
    
    var wrapper = document.createElement('div');
    wrapper.innerHTML = menuHTML;
    document.body.appendChild(wrapper);

    // Event Listeners
    if (document.addEventListener) {
        document.addEventListener('contextmenu', function(e) {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return true;
        
            // Evita sovrapposizioni con il menu Premium
            if (typeof UXPremium !== 'undefined') return true;
            if(document.querySelector('.ux-context-menu')) return true;
            if(document.getElementById('customContextMenu')) return true; 

            e.preventDefault();
            var menu = document.getElementById('globalContextMenu');
            menu.style.display = 'block';
            
            var x = e.clientX;
            var y = e.clientY;
            var w = window.innerWidth || document.documentElement.clientWidth;
            var h = window.innerHeight || document.documentElement.clientHeight;
            
            if (x + 220 > w) x = w - 220;
            if (y + 180 > h) y = h - 180;
            
            menu.style.left = x + 'px';
            menu.style.top = y + 'px';
        });

        document.addEventListener('click', function(e) {
            var menu = document.getElementById('globalContextMenu');
            if(menu) menu.style.display = 'none';
        });
    } else if (document.attachEvent) { // IE8 fallback
        document.attachEvent('oncontextmenu', function() {
            if(document.getElementById('customContextMenu')) return false; 
            var e = window.event;
            e.returnValue = false;
            var menu = document.getElementById('globalContextMenu');
            menu.style.display = 'block';
            var x = e.clientX;
            var y = e.clientY;
            menu.style.left = x + 'px';
            menu.style.top = y + 'px';
            return false;
        });
        document.attachEvent('onclick', function() {
            var menu = document.getElementById('globalContextMenu');
            if(menu) menu.style.display = 'none';
        });
    }

    // Drawer Logic
    window.ToggleGlobalDrawer = function() {
        var drw = document.getElementById('globalQuickDrawer');
        if(drw.style.right === '0px') {
            drw.style.right = '-320px';
        } else {
            drw.style.right = '0px';
            document.getElementById('globalQuickNotesArea').focus();
        }
    };

    window.GlobalPrint = function() {
        var menu = document.getElementById('globalContextMenu');
        if(menu) menu.style.display = 'none';
        
        // Diamo il tempo al menu di sparire visivamente
        setTimeout(function(){
            window.focus();
            
            // 1. Se la maschera ha una sua funzione PDF Premium, usa quella!
            if (typeof window.EsportaPDFProfessionale === 'function') {
                window.EsportaPDFProfessionale(false);
                return;
            }
            if (typeof window.GeneraPDFRegistro === 'function') {
                window.GeneraPDFRegistro();
                return;
            }
            
            try {
                // Proviamo prima il metodo standard
                window.print();
            } catch(e) {
                // Fallback su ActiveX se window.print() fallisce
                try {
                    var wb = document.getElementById('GlobalWebBrowserPrint');
                    if (!wb) {
                        var obj = document.createElement('object');
                        obj.id = 'GlobalWebBrowserPrint';
                        obj.width = 0;
                        obj.height = 0;
                        obj.classid = 'CLSID:8856F961-340A-11D0-A96B-00C04FD705A2';
                        document.body.appendChild(obj);
                        wb = obj;
                    }
                    wb.ExecWB(6, 1); // 6 = OLECMDID_PRINT, 1 = PROMPTUSER
                } catch(e2) {
                    alert("Impossibile avviare la stampa: " + e.message + " | " + e2.message);
                }
            }
        }, 200);
    };

    // Auto-save notes
    setTimeout(function() {
        var notesArea = document.getElementById('globalQuickNotesArea');
        if(notesArea) {
            try {
                var fso = new ActiveXObject("Scripting.FileSystemObject");
                var wsh = new ActiveXObject("WScript.Shell");
                var docs = wsh.SpecialFolders("MyDocuments");
                var noteFile = docs + "\\\\Logistica_Appunti.txt";
                
                if (fso.FileExists(noteFile)) {
                    var stream = fso.OpenTextFile(noteFile, 1, false, -1);
                    if (!stream.AtEndOfStream) {
                        notesArea.value = stream.ReadAll();
                    }
                    stream.Close();
                }
                
                notesArea.onkeyup = function() {
                    try {
                        var out = fso.CreateTextFile(noteFile, true, true);
                        out.Write(this.value);
                        out.Close();
                    } catch(e){}
                };
            } catch(e) {}
        }
    }, 500);
})();

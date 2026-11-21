/**
 * REGALO CHICCA: Modalità HACKER Globale (Easter Egg)
 */
var hackBuffer = "";
document.addEventListener('keydown', function(e) {
    var tag = e.target.tagName;
    if (e.key && e.key.length === 1 && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        hackBuffer += e.key.toLowerCase();
        if (hackBuffer.length > 6) hackBuffer = hackBuffer.substring(hackBuffer.length - 6);
        if (hackBuffer === "matrix") {
            AttivaHackerModeGlobale();
            hackBuffer = ""; // reset
        }
    }
});

function AttivaHackerModeGlobale() {
    var style = document.createElement('style');
    style.innerHTML = "" +
        "body, .main-dashboard-wrap, .admin-body, .card, .user-grid, .details-body, .log-content, .bottom-bar, .container, .sidebar, .content { background: #000 !important; color: #0f0 !important; border-color: #0f0 !important; font-family: Consolas, monospace !important; }\n" +
        ".user-card, .stat-card, .log-container, .admin-header, .panel, .widget { background: #0a0a0a !important; border: 1px solid #0f0 !important; box-shadow: 0 0 10px #0f0 !important; }\n" +
        ".u-name, .stat-value, .stat-label, h1, h2, h3, p, label, .insight-box, span, div, a { color: #0f0 !important; }\n" +
        "img:not(.leaflet-tile), .avatar { filter: grayscale(100%) sepia(100%) hue-rotate(90deg) saturate(500%) contrast(150%); }\n" +
        "input, select, textarea { background: #000 !important; color: #0f0 !important; border: 1px solid #0f0 !important; }\n" +
        ".btn, .row-btn, button { background: #000 !important; color: #0f0 !important; border: 2px solid #0f0 !important; box-shadow: 0 0 15px #0f0 !important; }\n";
    document.head.appendChild(style);
    
    try {
        var voice = new ActiveXObject("SAPI.SpVoice");
        voice.Speak("Accesso al mainframe completato. Modalità hacker attivata su questo modulo.");
    } catch(e) {}
    
    setTimeout(function() {
        if(style.parentNode) style.parentNode.removeChild(style);
    }, 10000);
}

// Iniezione globale del suggerimento visivo
(function() {
    try {
        var hint = document.createElement("div");
        hint.innerHTML = "💡 <b>TIP</b>";
        hint.title = "Easter Egg Admin";
        hint.style.position = "fixed";
        hint.style.bottom = "15px";
        hint.style.right = "15px";
        hint.style.padding = "5px 10px";
        hint.style.background = "#0f172a";
        hint.style.color = "#0ea5e9";
        hint.style.borderRadius = "20px";
        hint.style.opacity = "0.4";
        hint.style.fontSize = "11px";
        hint.style.fontFamily = "sans-serif";
        hint.style.cursor = "pointer";
        hint.style.zIndex = "9999999";
        hint.style.border = "1px solid #38bdf8";
        hint.style.boxShadow = "0 4px 6px rgba(0,0,0,0.1)";
        
        try {
            var savedTipPos = localStorage.getItem("hackerTipPosition");
            if (savedTipPos) {
                var pos = JSON.parse(savedTipPos);
                if (pos && typeof pos.left === "number" && typeof pos.top === "number") {
                    hint.style.left = pos.left + "px";
                    hint.style.top = pos.top + "px";
                    hint.style.bottom = "auto";
                    hint.style.right = "auto";
                }
            }
        } catch(eLoc) {}

        hint.style.cursor = "grab";
        hint.style.touchAction = "none";
        
        var isDragging = false;
        var dragStartX = 0, dragStartY = 0, hintStartX = 0, hintStartY = 0;
        var hasMoved = false;

        hint.onmousedown = function(e) {
            e = e || window.event;
            isDragging = true;
            hasMoved = false;
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            var rect = hint.getBoundingClientRect();
            hintStartX = rect.left;
            hintStartY = rect.top;
            hint.style.cursor = "grabbing";
            hint.style.transition = "none";
            if (e.preventDefault) e.preventDefault();
            return false;
        };

        hint.ontouchstart = function(e) {
            if (!e.touches || e.touches.length !== 1) return;
            var touch = e.touches[0];
            isDragging = true;
            hasMoved = false;
            dragStartX = touch.clientX;
            dragStartY = touch.clientY;
            var rect = hint.getBoundingClientRect();
            hintStartX = rect.left;
            hintStartY = rect.top;
            hint.style.transition = "none";
        };

        var onTipMove = function(e) {
            if (!isDragging) return;
            e = e || window.event;
            var clientX = e.clientX;
            var clientY = e.clientY;
            if (e.touches && e.touches.length > 0) {
                clientX = e.touches[0].clientX;
                clientY = e.touches[0].clientY;
            }
            var deltaX = clientX - dragStartX;
            var deltaY = clientY - dragStartY;
            if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
                hasMoved = true;
            }
            var newLeft = hintStartX + deltaX;
            var newTop = hintStartY + deltaY;
            var maxLeft = window.innerWidth - hint.offsetWidth - 5;
            var maxTop = window.innerHeight - hint.offsetHeight - 5;
            if (newLeft < 5) newLeft = 5;
            if (newLeft > maxLeft) newLeft = maxLeft;
            if (newTop < 5) newTop = 5;
            if (newTop > maxTop) newTop = maxTop;

            hint.style.left = newLeft + "px";
            hint.style.top = newTop + "px";
            hint.style.bottom = "auto";
            hint.style.right = "auto";

            if (e.touches && e.preventDefault) e.preventDefault();
        };

        var onTipEnd = function(e) {
            if (!isDragging) return;
            isDragging = false;
            hint.style.cursor = "grab";
            hint.style.transition = "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)";
            if (hasMoved) {
                var rect = hint.getBoundingClientRect();
                try {
                    localStorage.setItem("hackerTipPosition", JSON.stringify({ left: rect.left, top: rect.top }));
                } catch(eLoc) {}
            }
        };

        if (document.addEventListener) {
            document.addEventListener("mousemove", onTipMove, false);
            document.addEventListener("mouseup", onTipEnd, false);
            document.addEventListener("touchmove", onTipMove, { passive: false });
            document.addEventListener("touchend", onTipEnd, false);
        }

        hint.onmouseover = function() { if (!isDragging) this.style.opacity = "1"; };
        hint.onmouseout = function() { if (!isDragging) this.style.opacity = "0.4"; };
        
        hint.onclick = function() { 
            if (hasMoved) return;
            var modalId = "hackerTipModal";
            if(document.getElementById(modalId)) return;
            
            var overlay = document.createElement("div");
            overlay.id = modalId;
            overlay.style.position = "fixed";
            overlay.style.top = "0"; overlay.style.left = "0";
            overlay.style.width = "100%"; overlay.style.height = "100%";
            overlay.style.backgroundColor = "rgba(10, 11, 16, 0.85)";
            // Fallback for older MSHTA filters
            if(overlay.style.backdropFilter === undefined) overlay.style.filter = "progid:DXImageTransform.Microsoft.gradient(startColorstr=#D90A0B10, endColorstr=#D90A0B10)";
            overlay.style.zIndex = "10000";
            overlay.style.display = "flex";
            overlay.style.alignItems = "center";
            overlay.style.justifyContent = "center";
            
            var box = document.createElement("div");
            box.style.background = "linear-gradient(145deg, #1e2130 0%, #0f111a 100%)";
            box.style.border = "1px solid rgba(212, 175, 55, 0.5)";
            box.style.borderRadius = "15px";
            box.style.padding = "30px";
            box.style.width = "350px";
            box.style.boxShadow = "0 20px 40px rgba(0,0,0,0.8), 0 0 20px rgba(212, 175, 55, 0.2)";
            box.style.textAlign = "center";
            box.style.fontFamily = "'Segoe UI', system-ui, sans-serif";
            box.style.color = "#fff";
            
            var icon = document.createElement("div");
            icon.innerHTML = "🔒";
            icon.style.fontSize = "40px";
            icon.style.marginBottom = "15px";
            
            var title = document.createElement("h3");
            title.innerHTML = "SEGRETO DI SISTEMA";
            title.style.margin = "0 0 15px 0";
            title.style.color = "#d4af37";
            title.style.letterSpacing = "1px";
            title.style.fontSize = "18px";
            
            var text1 = document.createElement("p");
            text1.innerHTML = "Prova a digitare la parola sulla tastiera:";
            text1.style.fontSize = "14px";
            text1.style.color = "#cbd5e1";
            text1.style.marginBottom = "15px";
            text1.style.marginTop = "0";
            
            var word = document.createElement("div");
            word.innerHTML = "HACK";
            word.style.background = "rgba(0,0,0,0.5)";
            word.style.border = "1px dashed #d4af37";
            word.style.display = "inline-block";
            word.style.padding = "8px 20px";
            word.style.fontSize = "22px";
            word.style.fontWeight = "bold";
            word.style.color = "#ffe066";
            word.style.letterSpacing = "4px";
            word.style.borderRadius = "8px";
            word.style.marginBottom = "20px";
            
            var text2 = document.createElement("p");
            text2.innerHTML = "<i>(Puoi farlo in qualsiasi schermata senza cliccare su nulla, basta usare la tastiera!)</i>";
            text2.style.fontSize = "12px";
            text2.style.color = "#94a3b8";
            text2.style.marginBottom = "25px";
            text2.style.lineHeight = "1.4";
            
            var btn = document.createElement("button");
            btn.innerHTML = "Ho capito";
            btn.style.background = "linear-gradient(to bottom, #ffe066, #d4af37)";
            btn.style.color = "#000";
            btn.style.border = "none";
            btn.style.padding = "10px 30px";
            btn.style.borderRadius = "20px";
            btn.style.fontWeight = "bold";
            btn.style.cursor = "pointer";
            
            btn.onclick = function() { document.body.removeChild(overlay); };
            
            box.appendChild(icon);
            box.appendChild(title);
            box.appendChild(text1);
            box.appendChild(word);
            box.appendChild(text2);
            box.appendChild(btn);
            overlay.appendChild(box);
            document.body.appendChild(overlay);
            
            try {
                var voice = new ActiveXObject("SAPI.SpVoice");
                voice.Speak("Segreto di sistema. Prova a digitare la parola hack.", 3);
            } catch(e) {}
        };
        
        document.body.appendChild(hint);
    } catch(e) {}
})();

/**
 * OVERRIDE GLOBALE ALERT: Rende tutti i messaggi (alert) eleganti e conformi al design Premium
 */
window.alert = function(message) {
    // Rimuove eventuali alert precedenti
    var oldAlert = document.getElementById("premium-alert-overlay");
    if(oldAlert) oldAlert.parentNode.removeChild(oldAlert);

    var overlay = document.createElement("div");
    overlay.id = "premium-alert-overlay";
    overlay.style.position = "fixed";
    overlay.style.top = "0"; overlay.style.left = "0";
    overlay.style.width = "100%"; overlay.style.height = "100%";
    overlay.style.backgroundColor = "rgba(10, 11, 16, 0.75)";
    overlay.style.zIndex = "999999";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    
    // Analizza se è un errore o info
    var msgLower = message.toLowerCase();
    var isError = msgLower.indexOf("errore") !== -1 || msgLower.indexOf("non inserita") !== -1 || msgLower.indexOf("impossibile") !== -1 || msgLower.indexOf("errato") !== -1;
    var icon = isError ? "⚠️" : "💬";
    var color = isError ? "#f59e0b" : "#0ea5e9";
    var borderGlow = isError ? "rgba(245, 158, 11, 0.3)" : "rgba(14, 165, 233, 0.3)";
    
    var box = document.createElement("div");
    box.style.background = "linear-gradient(145deg, #1e293b, #0f172a)";
    box.style.border = "1px solid " + color;
    box.style.borderRadius = "16px";
    box.style.padding = "25px 35px";
    box.style.minWidth = "300px";
    box.style.maxWidth = "450px";
    box.style.boxShadow = "0 25px 50px -12px rgba(0,0,0,0.8), 0 0 25px " + borderGlow;
    box.style.textAlign = "center";
    box.style.fontFamily = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
    box.style.color = "#f8fafc";
    box.style.transform = "scale(0.9)";
    box.style.opacity = "0";
    box.style.transition = "all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)";
    
    var iconDiv = document.createElement("div");
    iconDiv.innerHTML = icon;
    iconDiv.style.fontSize = "38px";
    iconDiv.style.marginBottom = "15px";
    iconDiv.style.textShadow = "0 0 15px " + color;
    
    var msgDiv = document.createElement("div");
    // Convertiamo i newline in <br> per la formattazione
    msgDiv.innerHTML = message.replace(/\n/g, "<br>");
    msgDiv.style.fontSize = "14.5px";
    msgDiv.style.lineHeight = "1.5";
    msgDiv.style.marginBottom = "25px";
    msgDiv.style.fontWeight = "500";
    msgDiv.style.letterSpacing = "0.3px";
    msgDiv.style.wordWrap = "break-word";
    msgDiv.style.wordBreak = "break-word";
    msgDiv.style.overflowWrap = "break-word";
    
    var btn = document.createElement("button");
    btn.innerHTML = "HO CAPITO";
    btn.style.background = isError ? "linear-gradient(to right, #d97706, #b45309)" : "linear-gradient(to right, #0284c7, #0369a1)";
    btn.style.color = "#fff";
    btn.style.border = "1px solid rgba(255,255,255,0.1)";
    btn.style.padding = "10px 30px";
    btn.style.borderRadius = "8px";
    btn.style.fontWeight = "800";
    btn.style.fontSize = "12px";
    btn.style.cursor = "pointer";
    btn.style.letterSpacing = "1px";
    btn.style.boxShadow = "0 4px 10px rgba(0,0,0,0.3)";
    btn.style.transition = "all 0.15s";
    
    btn.onmouseover = function() { this.style.transform = "scale(1.05)"; this.style.filter = "brightness(1.2)"; };
    btn.onmouseout = function() { this.style.transform = "scale(1)"; this.style.filter = "brightness(1)"; };
    
    btn.onclick = function() {
        box.style.transform = "scale(0.8)";
        box.style.opacity = "0";
        overlay.style.backgroundColor = "transparent";
        setTimeout(function(){ if(overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 200);
    };
    
    // Supporto per chiusura con tasto Invio o ESC
    overlay.onkeydown = function(e) {
        if(e.key === "Enter" || e.key === "Escape") { btn.click(); }
    };
    
    box.appendChild(iconDiv);
    box.appendChild(msgDiv);
    box.appendChild(btn);
    overlay.appendChild(box);
    
    document.body.appendChild(overlay);
    
    // Innesca l'animazione di entrata
    setTimeout(function() {
        box.style.transform = "scale(1)";
        box.style.opacity = "1";
        btn.focus();
    }, 10);
};

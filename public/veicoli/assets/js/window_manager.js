var WindowManager = (function() {
    var activeModalId = null;
    var overlayBg = null;

    function init() {
        if(!overlayBg) {
            overlayBg = document.createElement('div');
            overlayBg.id = 'wm-overlay-bg';
            overlayBg.style.cssText = 'display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); z-index:900;';
            overlayBg.onclick = function() { closeActive(); };
            document.body.appendChild(overlayBg);
        }
        
        document.onkeydown = function(e) {
            e = e || window.event;
            if (e.keyCode == 27) { // ESC
                closeActive();
            }
        };
    }

    function open(modalId, zIndexOverride) {
        if(!overlayBg) init();
        
        // Se c'è già una modale, chiudila prima
        if(activeModalId && activeModalId !== modalId) {
            closeActive(true);
        }
        
        var modal = document.getElementById(modalId);
        if(!modal) return;
        
        activeModalId = modalId;
        overlayBg.style.display = 'block';
        
        modal.style.display = 'flex'; // o 'block' a seconda del css
        modal.style.zIndex = zIndexOverride || 1000;
        
        // Animazione fade in (se supportata dal CSS)
        modal.style.opacity = 0;
        var op = 0;
        var timer = setInterval(function() {
            if (op >= 1) { clearInterval(timer); }
            modal.style.opacity = op;
            op += 0.1;
        }, 10);
    }

    function closeActive(noFocus) {
        if(!activeModalId) return;
        
        var modal = document.getElementById(activeModalId);
        if(modal) {
            modal.style.display = 'none';
        }
        
        activeModalId = null;
        overlayBg.style.display = 'none';
        
        if (!noFocus && typeof TornaInPrimoPiano === 'function') {
            TornaInPrimoPiano();
        }
    }

    return {
        open: open,
        close: closeActive,
        getActive: function() { return activeModalId; }
    };
})();

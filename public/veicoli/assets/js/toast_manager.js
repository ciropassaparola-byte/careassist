var ToastManager = (function() {
    var container;
    
    function init() {
        if(!document.getElementById('toast-container')) {
            container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        } else {
            container = document.getElementById('toast-container');
        }
    }
    
    function show(title, message, type, duration) {
        if(!container) init();
        
        type = type || 'info';
        duration = duration || 3000;
        
        var toast = document.createElement('div');
        toast.className = 'toast toast-' + type;
        
        var content = document.createElement('div');
        content.className = 'toast-content';
        
        var tTitle = document.createElement('div');
        tTitle.className = 'toast-title';
        tTitle.innerText = title;
        
        var tMsg = document.createElement('div');
        tMsg.className = 'toast-message';
        tMsg.innerText = message;
        
        var tProg = document.createElement('div');
        tProg.className = 'toast-progress-bar';
        tProg.style.animationDuration = duration + 'ms';
        
        content.appendChild(tTitle);
        content.appendChild(tMsg);
        toast.appendChild(content);
        toast.appendChild(tProg);
        
        container.appendChild(toast);
        
        setTimeout(function() {
            toast.className += ' toast-closing';
            setTimeout(function() {
                if(toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, duration);
    }
    
    return {
        success: function(msg, dur) { show("SUCCESSO", msg, "success", dur); },
        error: function(msg, dur) { show("ERRORE", msg, "error", dur); },
        warning: function(msg, dur) { show("ATTENZIONE", msg, "warning", dur); },
        info: function(msg, dur) { show("INFORMAZIONE", msg, "info", dur); },
        show: show
    };
})();

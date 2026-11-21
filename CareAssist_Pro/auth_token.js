/*
 * Suite C. Milella - Token di sessione per le API
 * ------------------------------------------------
 * - Salva il token emesso dal server al login (/api/auth/login) in localStorage.
 * - Aggiunge automaticamente "Authorization: Bearer <token>" alle chiamate fetch verso /api/.
 * - Se il server risponde 401 (token scaduto), rifà il login in modo trasparente con il PIN
 *   già salvato dal Launcher (presente solo finché l'operatore non fa "Esci").
 * - Se il PIN non è più valido (operatore disattivato o PIN cambiato) e ci si trova in
 *   CareAssist, avvisa e riporta al Launcher per un nuovo accesso.
 * Non modifica la logica di accesso esistente: il PIN resta assegnato dall'Admin.
 */
(function () {
    if (window.__milellaAuthFetch) return;
    window.__milellaAuthFetch = true;

    var KEY = 'milella_token';
    var origFetch = window.fetch.bind(window);
    var refreshing = null;
    var warned = false;

    function isApiUrl(u) {
        try {
            var x = new URL(u, window.location.href);
            return x.origin === window.location.origin && x.pathname.indexOf('/api/') === 0;
        } catch (e) { return false; }
    }

    function storedPin() {
        return localStorage.getItem('milella_admin_pin') || localStorage.getItem('milella_user_pin') || '';
    }

    function silentLogin() {
        var pin = storedPin();
        if (!pin) return Promise.resolve(false);
        if (!refreshing) {
            refreshing = origFetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ codice: pin })
            }).then(function (r) { return r.json(); }).then(function (d) {
                if (d && d.success && d.token) { localStorage.setItem(KEY, d.token); return true; }
                localStorage.removeItem(KEY);
                return false;
            }).catch(function () { return false; }).then(function (ok) {
                refreshing = null;
                return ok;
            });
        }
        return refreshing;
    }

    function notifyUnauthorized() {
        if (warned) return;
        warned = true;
        if (window.location.pathname.indexOf('/careassist') === 0) {
            alert('Accesso scaduto o non autorizzato.\nRientra dal Launcher con il tuo PIN personale.');
            window.location.href = '/launcher.html';
        }
    }

    function send(input, init) {
        var tok = localStorage.getItem(KEY);
        if (!tok) return origFetch(input, init);
        var opts = Object.assign({}, init || {});
        var h = new Headers(opts.headers || undefined);
        h.set('Authorization', 'Bearer ' + tok);
        opts.headers = h;
        return origFetch(input, opts);
    }

    window.fetch = function (input, init) {
        if (typeof input !== 'string' || !isApiUrl(input)) return origFetch(input, init);

        // Login: conserva il token ricevuto (funziona per tutte le modalità di accesso del Launcher)
        if (input.indexOf('/api/auth/login') >= 0) {
            return origFetch(input, init).then(function (res) {
                try {
                    res.clone().json().then(function (d) {
                        if (d && d.token) localStorage.setItem(KEY, d.token);
                    }).catch(function () {});
                } catch (e) {}
                return res;
            });
        }

        return send(input, init).then(function (res) {
            if (res.status !== 401) return res;
            return silentLogin().then(function (ok) {
                if (ok) return send(input, init);
                notifyUnauthorized();
                return res;
            });
        });
    };
})();

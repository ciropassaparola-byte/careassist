// Polyfill per HTA in Electron
function EscapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
if (typeof window !== "undefined") window.EscapeHTML = EscapeHTML;

function EscapeJS(str) {
    if (!str) return '';
    return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
}
if (typeof window !== "undefined") window.EscapeJS = EscapeJS;

window.Enumerator = function(collection) {
    this.items = collection || [];
    this.index = 0;
    this.atEnd = function() { return this.index >= this.items.length; };
    this.moveNext = function() { this.index++; };
    this.item = function() { return this.items[this.index]; };
};

// Polyfill universale addEventListener / removeEventListener per vecchi ambienti HTA / IE
(function() {
    function setupEventListenerPolyfill(target) {
        if (!target) return;
        if (!target.addEventListener && target.attachEvent) {
            target.addEventListener = function(event, handler, useCapture) {
                var wrappedHandler = function(e) {
                    e = e || window.event;
                    if (e && !e.target) e.target = e.srcElement;
                    if (e && !e.preventDefault) e.preventDefault = function() { e.returnValue = false; };
                    if (e && !e.stopPropagation) e.stopPropagation = function() { e.cancelBubble = true; };
                    return handler.call(target, e);
                };
                if (!handler._ieWrapped) handler._ieWrapped = {};
                handler._ieWrapped[event] = wrappedHandler;
                target.attachEvent('on' + event, wrappedHandler);
            };
        }
        if (!target.removeEventListener && target.detachEvent) {
            target.removeEventListener = function(event, handler, useCapture) {
                var wrapped = (handler._ieWrapped && handler._ieWrapped[event]) ? handler._ieWrapped[event] : handler;
                target.detachEvent('on' + event, wrapped);
            };
        }
    }
    if (typeof window !== "undefined") setupEventListenerPolyfill(window);
    if (typeof document !== "undefined") setupEventListenerPolyfill(document);
})();

if (typeof window.ActiveXObject === "undefined") {
    window.ActiveXObject = function(progId) {
        var fs = (typeof require !== 'undefined') ? require('fs') : null;
        var path = (typeof require !== 'undefined') ? (function(){ try { return require('path'); } catch(e){ return null; } })() : null;
        var fs = (typeof require !== 'undefined') ? (function(){ try { return require('fs'); } catch(e){ return null; } })() : null;
        var cp = (typeof require !== 'undefined') ? (function(){ try { return require('child_process'); } catch(e){ return null; } })() : null;

        if (progId === "Scripting.FileSystemObject") {
            return {
                BuildPath: function(p1, p2) {
                    p1 = p1 || "";
                    p2 = p2 || "";
                    if (path && path.join) {
                        try { return path.join(p1, p2); } catch(eJoin){}
                    }
                    var clean1 = String(p1).replace(/[\/\\]+$/, "");
                    var clean2 = String(p2).replace(/^[\/\\]+/, "");
                    return clean1 ? clean1 + "/" + clean2 : clean2;
                },
                FileExists: function(p) {
                    if (fs && fs.existsSync) {
                        try { return fs.existsSync(p); } catch(eFs){ return false; } } if (!fs && typeof localStorage !== 'undefined' && localStorage.getItem('vfs_' + p) !== null) return true; return false;
                },
                FolderExists: function(p) {
                    if (fs && fs.existsSync) {
                        try { return fs.existsSync(p) && fs.statSync(p).isDirectory(); } catch(eFs){ return false; }
                    }
                    return false;
                },
                CreateFolder: function(p) {
                    if (fs && fs.mkdirSync) {
                        try { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); } catch(eMk){}
                    }
                    return {};
                },
                createFolder: function(p) {
                    if (fs && fs.mkdirSync) {
                        try { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); } catch(eMk){}
                    }
                    return {};
                },
                GetFolder: function(p) {
                    if (fs && fs.readdirSync) {
                        try {
                            if (!fs.existsSync(p)) return { Files: [] };
                            var filesList = fs.readdirSync(p);
                            var files = [];
                            for (var idx = 0; idx < filesList.length; idx++) {
                                var f = filesList[idx];
                                var fullF = path ? path.join(p, f) : (p + "/" + f);
                                if (fs.statSync(fullF).isFile()) {
                                    files.push({ Name: f, Path: fullF });
                                }
                            }
                            return { Files: files };
                        } catch(eFol){ return { Files: [] }; }
                    }
                    return { Files: [] };
                },
                GetParentFolderName: function(p) {
                    if (!p) return "";
                    if (path && path.dirname) {
                        try { return path.dirname(p); } catch(eDir){}
                    }
                    var cleanP = String(p).replace(/\\/g, '/');
                    var parts = cleanP.split('/');
                    parts.pop();
                    return parts.join('/') || ".";
                },
                GetFileName: function(p) {
                    if (!p) return "";
                    if (path && path.basename) {
                        try { return path.basename(p); } catch(eBase){}
                    }
                    var cleanP = String(p).replace(/\\/g, '/');
                    return cleanP.split('/').pop() || "";
                },
                OpenTextFile: function(p, iomode, create, format) {
                    var modeStr = (iomode === 2) ? 'w' : (iomode === 8 ? 'a' : 'r'); if (!fs) { var content = ""; if (typeof localStorage !== 'undefined') { if (modeStr === 'r') content = localStorage.getItem('vfs_' + p) || ""; else if (modeStr === 'w') { localStorage.setItem('vfs_' + p, ''); content = ""; } } var lines = content.split(/\r?\n/); var lineIndex = 0; return { ReadAll: function() { return content; }, ReadLine: function() { return lineIndex < lines.length ? lines[lineIndex++] : null; }, Write: function(data) { if (typeof localStorage !== 'undefined') { var cur = localStorage.getItem('vfs_' + p) || ""; localStorage.setItem('vfs_' + p, cur + data); } }, WriteLine: function(data) { if (typeof localStorage !== 'undefined') { var cur = localStorage.getItem('vfs_' + p) || ""; localStorage.setItem('vfs_' + p, cur + data + '\r\n'); } }, Close: function() {}, AtEndOfStream: true }; }
                    var modeStr = (iomode === 2) ? 'w' : (iomode === 8 ? 'a' : 'r');
                    var encoding = (format === -1) ? 'utf16le' : 'utf8';
                    if (modeStr === 'r' && !fs.existsSync(p)) {
                       if (create) { fs.writeFileSync(p, '', encoding); }
                       else throw new Error("File not found");
                    }
                    var lines = [];
                    var lineIndex = 0;
                    if (modeStr === 'r') {
                        var content = fs.readFileSync(p, encoding);
                        lines = content.split(/\r?\n/);
                    } else if (modeStr === 'w') {
                        fs.writeFileSync(p, '', encoding); 
                    }
                    var stream = {
                        ReadAll: function() { return fs.readFileSync(p, encoding); },
                        ReadLine: function() { 
                            if (lineIndex < lines.length) return lines[lineIndex++];
                            return null;
                        },
                        Write: function(data) { fs.appendFileSync(p, data, encoding); },
                        WriteLine: function(data) { fs.appendFileSync(p, data + '\r\n', encoding); },
                        Close: function() {}
                    };
                    if (typeof Object.defineProperty !== "undefined") {
                        Object.defineProperty(stream, "AtEndOfStream", {
                            get: function() { return lineIndex >= lines.length; },
                            configurable: true,
                            enumerable: true
                        });
                    } else {
                        stream.AtEndOfStream = (lineIndex >= lines.length); // Fallback statico
                    }
                    return stream;
                },
                CopyFile: function(src, dest, overwrite) {
                    if (fs) fs.copyFileSync(src, dest);
                },
                DeleteFile: function(p) {
                    if(fs && fs.existsSync(p)) fs.unlinkSync(p); if(!fs && typeof localStorage !== 'undefined') localStorage.removeItem('vfs_' + p);
                },
                MoveFile: function(src, dest) {
                    if (fs) fs.renameSync(src, dest);
                },
                CreateTextFile: function(p, overwrite, unicode) {
                    if (!fs) { if (typeof localStorage !== 'undefined') localStorage.setItem('vfs_' + p, ''); return this.OpenTextFile(p, 2, false, unicode ? -1 : 0); }
                    var enc = unicode ? 'utf16le' : 'utf8';
                    fs.writeFileSync(p, '', enc);
                    return this.OpenTextFile(p, 2, false, unicode ? -1 : 0);
                },
                GetSpecialFolder: function(type) {
                    var os = (typeof require !== 'undefined') ? require('os') : null;
                    var tmpDir = os ? os.tmpdir() : ((typeof process !== 'undefined' && process.env && process.env.TEMP) ? process.env.TEMP : "C:\\Windows\\Temp");
                    return { Path: tmpDir, path: tmpDir };
                },
                getSpecialFolder: function(type) {
                    var os = (typeof require !== 'undefined') ? require('os') : null;
                    var tmpDir = os ? os.tmpdir() : ((typeof process !== 'undefined' && process.env && process.env.TEMP) ? process.env.TEMP : "C:\\Windows\\Temp");
                    return { Path: tmpDir, path: tmpDir };
                },
                DriveExists: function(d) {
                    var drive = d.replace(/[:\\/]/g, '').toUpperCase() + ':\\';
                    try { return fs.existsSync(drive); } catch(e) { return false; }
                },
                GetDrive: function(d) {
                    var drive = d.replace(/[:\\/]/g, '').toUpperCase() + ':\\';
                    if (!this.DriveExists(drive)) throw new Error("Drive not found");
                    var driveObj = {
                        DriveLetter: d.replace(/[:\\/]/g, '').toUpperCase(),
                        DriveType: 1
                    };
                    if (typeof Object.defineProperty !== "undefined") {
                        Object.defineProperty(driveObj, "IsReady", {
                            get: function() {
                                try { fs.readdirSync(drive); return true; } catch(e) { return false; }
                            },
                            configurable: true,
                            enumerable: true
                        });
                    } else {
                        driveObj.IsReady = true; // Fallback statico
                    }
                    return driveObj;
                }
            };
        }
        if (progId === "WScript.Shell") {
            var getSpecialFolder = function(folderName) {
                var os = (typeof require !== 'undefined') ? (function(){ try { return require('os'); } catch(e){ return null; } })() : null;
                var path = (typeof require !== 'undefined') ? (function(){ try { return require('path'); } catch(e){ return null; } })() : null;
                var home = (os && os.homedir) ? os.homedir() : ((typeof process !== 'undefined' && process.env) ? (process.env.USERPROFILE || process.env.HOME) : "C:\\Users\\Utente");
                if (String(folderName).toLowerCase() === "desktop") {
                    return path ? path.join(home, "Desktop") : (home + "\\Desktop");
                }
                return home;
            };

            var specialFoldersObj = function(folderName) {
                return getSpecialFolder(folderName);
            };
            specialFoldersObj.Item = getSpecialFolder;
            specialFoldersObj.item = getSpecialFolder;

            return {
                SpecialFolders: specialFoldersObj,
                specialFolders: specialFoldersObj,
                ExpandEnvironmentStrings: function(str) {
                    return str.replace(/%([^%]+)%/g, function(match, varName) {
                        return process.env[varName] || match;
                    });
                },
                Run: function(cmd, style, wait) {
                    try {
                        if (cmd.indexOf("mshta.exe") > -1 && cmd.toLowerCase().indexOf("taskkill") === -1) {
                            var targetPath = "";
                            if (cmd.indexOf('"') > -1) {
                                var matches = cmd.match(/"([^"]+)"/g);
                                if (matches && matches.length > 0) {
                                    targetPath = matches[matches.length - 1].replace(/"/g, '');
                                }
                            }
                            if (!targetPath) targetPath = cmd.replace(/mshta\.exe/i, '').trim();
                            
                            targetPath = targetPath.replace(/\.hta/i, '.html');
                            if (targetPath.indexOf("File_Sistema") > -1) {
                                targetPath = targetPath.substring(targetPath.indexOf("File_Sistema"));
                            }
                            targetPath = targetPath.replace(/\\/g, '/');

                            try {
                                if (typeof window !== "undefined" && window.open) {
                                    window.open(targetPath, "_blank", "width=1300,height=850");
                                    return;
                                }
                            } catch(eOpen) {}

                            window.location.href = targetPath;
                            return;
                        }
                        
                        var cleanCmd = cmd.replace(/^["']|["']$/g, '').trim();
                        var isWebUrl = cleanCmd.match(/^https?:\/\//i) || cleanCmd.match(/^mailto:/i) || cleanCmd.match(/^tel:/i) || cleanCmd.match(/^www\./i);
                        if (isWebUrl) {
                            if (cleanCmd.match(/^www\./i)) {
                                cleanCmd = "http://" + cleanCmd;
                            }
                            cmd = 'start "" "' + cleanCmd + '"';
                        }

                       if (cp && (cp.exec || cp.execSync)) {
                           if (wait && cp.execSync) {
                               try { cp.execSync(cmd, { windowsHide: true }); } catch(eWait){}
                           } else if (cp.exec) {
                               try { cp.exec(cmd, { windowsHide: true }); } catch(eExec){}
                           }
                       } else {
                           console.log("Polyfill WScript.Shell.Run (Web mode): " + cmd);
                       }
                    } catch(e) { console.error("Run error: " + cmd, e); }
                },
                Popup: function(text, seconds, title, type) {
                    alert((title ? title + "\n\n" : "") + text);
                },
                Exec: function(cmd) {
                    try {
                        if (cp && cp.execSync) {
                            var result = cp.execSync(cmd, { windowsHide: true, encoding: 'utf8', timeout: 30000 });
                            return {
                                StdOut: { ReadAll: function() { return result; } },
                                StdErr: { ReadAll: function() { return ""; } },
                                Status: 0,
                                ExitCode: 0
                            };
                        }
                    } catch(eExec) {
                        return {
                            StdOut: { ReadAll: function() { return ""; } },
                            StdErr: { ReadAll: function() { return eExec.message; } },
                            Status: 1,
                            ExitCode: 1
                        };
                    }
                    return {
                        StdOut: { ReadAll: function() { return ""; } },
                        StdErr: { ReadAll: function() { return ""; } },
                        Status: 0,
                        ExitCode: 0
                    };
                }
            };
        }
        if (progId === "WinHttp.WinHttpRequest.5.1" || progId.indexOf("XMLHTTP") !== -1 || progId.indexOf("ServerXMLHTTP") !== -1) {
            var xhr = new window.XMLHttpRequest();
            var xhrWrapper = {
                _timeout: 0,
                _isAsync: true,
                Open: function(m, u, a) {
                    this._isAsync = (a !== false);
                    try { xhr.timeout = 0; } catch(e){}
                    xhr.open(m, u, a);
                },
                open: function(m, u, a) {
                    this._isAsync = (a !== false);
                    try { xhr.timeout = 0; } catch(e){}
                    xhr.open(m, u, a);
                },
                Send: function(d) {
                    if (this._isAsync && this._timeout > 0) {
                        try { xhr.timeout = this._timeout; } catch(e){}
                    }
                    xhr.send(d);
                },
                send: function(d) {
                    if (this._isAsync && this._timeout > 0) {
                        try { xhr.timeout = this._timeout; } catch(e){}
                    }
                    xhr.send(d);
                },
                SetRequestHeader: function(h, v) { xhr.setRequestHeader(h, v); },
                setRequestHeader: function(h, v) { xhr.setRequestHeader(h, v); },
                SetTimeouts: function(resolve, connect, send, receive) { this._timeout = receive; },
                setTimeout: function(resolve, connect, send, receive) { this._timeout = receive; },
                setTimeouts: function(resolve, connect, send, receive) { this._timeout = receive; },
                WaitForResponse: function(timeout) { return true; },
                abort: function() { xhr.abort(); },
                Abort: function() { xhr.abort(); }
            };

            if (typeof Object.defineProperty !== "undefined") {
                Object.defineProperty(xhrWrapper, "ResponseText", { get: function() { return xhr.responseText; }, configurable: true, enumerable: true });
                Object.defineProperty(xhrWrapper, "responseText", { get: function() { return xhr.responseText; }, configurable: true, enumerable: true });
                Object.defineProperty(xhrWrapper, "Status", { get: function() { return xhr.status; }, configurable: true, enumerable: true });
                Object.defineProperty(xhrWrapper, "status", { get: function() { return xhr.status; }, configurable: true, enumerable: true });
                Object.defineProperty(xhrWrapper, "StatusText", { get: function() { return xhr.statusText; }, configurable: true, enumerable: true });
                Object.defineProperty(xhrWrapper, "responseXML", { get: function() { return xhr.responseXML; }, configurable: true, enumerable: true });
                Object.defineProperty(xhrWrapper, "readyState", { get: function() { return xhr.readyState; }, configurable: true, enumerable: true });
                Object.defineProperty(xhrWrapper, "ReadyState", { get: function() { return xhr.readyState; }, configurable: true, enumerable: true });
                
                Object.defineProperty(xhrWrapper, "onreadystatechange", {
                    get: function() { return xhr.onreadystatechange; },
                    set: function(fn) { xhr.onreadystatechange = fn; },
                    configurable: true,
                    enumerable: true
                });
            } else {
                xhrWrapper.ResponseText = "";
                xhrWrapper.responseText = "";
                xhrWrapper.Status = 200;
                xhrWrapper.status = 200;
                xhrWrapper.StatusText = "OK";
            }
            return xhrWrapper;
        }
        if (progId === "SAPI.SpVoice") {
            return {
                Speak: function(text) {
                    var doSpeak = function() {
                        var msg = new SpeechSynthesisUtterance(text);
                        msg.lang = "it-IT";
                        
                        if (window.speechSynthesis && window.speechSynthesis.getVoices) {
                            var voices = window.speechSynthesis.getVoices();
                            var selectedVoice = null;
                            
                            for (var i = 0; i < voices.length; i++) {
                                var vName = voices[i].name.toLowerCase();
                                if (vName.indexOf("siri") !== -1 && voices[i].lang.indexOf("it") === 0) {
                                    selectedVoice = voices[i]; break;
                                }
                            }
                            if (!selectedVoice) {
                                for (var i = 0; i < voices.length; i++) {
                                    if (voices[i].name.toLowerCase().indexOf("elsa") !== -1) {
                                        selectedVoice = voices[i]; break;
                                    }
                                }
                            }
                            if (!selectedVoice) {
                                for (var i = 0; i < voices.length; i++) {
                                    if (voices[i].lang.indexOf("it") === 0) {
                                        selectedVoice = voices[i]; break;
                                    }
                                }
                            }
                            if (selectedVoice) {
                                msg.voice = selectedVoice;
                            }
                        }
                        
                        window.speechSynthesis.cancel();
                        window.speechSynthesis.speak(msg);
                    };
                    
                    if (window.speechSynthesis.getVoices().length === 0) {
                        window.speechSynthesis.addEventListener('voiceschanged', doSpeak, {once: true});
                    } else {
                        doSpeak();
                    }
                }
            };
        }
        if (progId === "ADODB.Stream") {
            var streamObj = {
                _dataBuffer: "",
                _charset: "utf-8",
                _type: 2,
                open: function() { this._dataBuffer = ""; },
                Open: function() { this._dataBuffer = ""; },
                WriteText: function(text) { this._dataBuffer += text; },
                writeText: function(text) { this._dataBuffer += text; },
                SaveToFile: function(p, options) {
                    var encoding = (this._charset.toLowerCase() === 'utf-16le' || this._charset.toLowerCase() === 'unicode') ? 'utf16le' : 'utf8';
                    fs.writeFileSync(p, this._dataBuffer, encoding);
                },
                saveToFile: function(p, options) {
                    var encoding = (this._charset.toLowerCase() === 'utf-16le' || this._charset.toLowerCase() === 'unicode') ? 'utf16le' : 'utf8';
                    fs.writeFileSync(p, this._dataBuffer, encoding);
                },
                Close: function() {},
                close: function() {}
            };
            if (typeof Object.defineProperty !== "undefined") {
                Object.defineProperty(streamObj, "Charset", {
                    get: function() { return this._charset; },
                    set: function(val) { this._charset = val; },
                    configurable: true,
                    enumerable: true
                });
                Object.defineProperty(streamObj, "charset", {
                    get: function() { return this._charset; },
                    set: function(val) { this._charset = val; },
                    configurable: true,
                    enumerable: true
                });
                Object.defineProperty(streamObj, "Type", {
                    get: function() { return this._type; },
                    set: function(val) { this._type = val; },
                    configurable: true,
                    enumerable: true
                });
                Object.defineProperty(streamObj, "type", {
                    get: function() { return this._type; },
                    set: function(val) { this._type = val; },
                    configurable: true,
                    enumerable: true
                });
            } else {
                streamObj.Charset = "utf-8";
                streamObj.charset = "utf-8";
                streamObj.Type = 2;
                streamObj.type = 2;
            }
            return streamObj;
        }
        if (progId === "Excel.Application" || progId.startsWith("Excel.Application")) {
            var makeDummySheet = function() {
                var dummyCell = {
                    Value: "", Text: "", Font: { Name: "Times New Roman", Bold: false, Size: 10 },
                    HorizontalAlignment: 0, VerticalAlignment: 0, Interior: { Color: 0, ColorIndex: 0 },
                    End: function() { return { Row: 31 }; }
                };
                var dummyRange = {
                    Value: "", Font: { Name: "Times New Roman", Bold: false, Size: 10 },
                    Clear: function(){}, ClearComments: function(){}, Copy: function(){},
                    Borders: { LineStyle: 1 }, HorizontalAlignment: 0, VerticalAlignment: 0,
                    Interior: { Color: 0, ColorIndex: 0 }, RowHeight: 14.25
                };
                var sheetObj = {
                    Name: "Settembre",
                    Cells: function(r, c) { return dummyCell; },
                    Range: function(r1, r2) { return dummyRange; },
                    Rows: function(r) { return { EntireRow: { Hidden: false } }; },
                    Columns: function(c) { return { ColumnWidth: 10, AutoFit: function(){} }; },
                    Shapes: { Count: 0, Item: function(){ return { Delete: function(){} }; }, Type: 0 }
                };
                sheetObj.Cells.Font = { Name: "Times New Roman" };
                sheetObj.Cells.ClearComments = function(){};
                sheetObj.Cells.Replace = function(){};
                sheetObj.Cells.Find = function(){ return null; };
                return sheetObj;
            };

            var makeWbProxy = function(filePath) {
                var sObj = makeDummySheet();
                return {
                    _filePath: filePath || "",
                    ActiveSheet: sObj,
                    Sheets: function(idx) { return sObj; },
                    Worksheets: function(idx) { return sObj; },
                    Save: function() {
                        if (filePath && typeof require !== 'undefined') {
                            try {
                                var cp = require('child_process');
                                cp.exec('start "" "' + filePath + '"', { windowsHide: true });
                            } catch(e){}
                        }
                    },
                    SaveAs: function(newPath) {
                        if (newPath && typeof require !== 'undefined') {
                            try {
                                var cp = require('child_process');
                                cp.exec('start "" "' + newPath + '"', { windowsHide: true });
                            } catch(e){}
                        }
                    },
                    Close: function(){},
                    ExportAsFixedFormat: function(){}
                };
            };

            return {
                Visible: false,
                DisplayAlerts: false,
                Workbooks: {
                    Open: function(filePath) {
                        return makeWbProxy(filePath);
                    },
                    Add: function() {
                        return makeWbProxy("");
                    }
                },
                Quit: function(){}
            };
        }
        
        if (progId === "Shell.Application" || progId.indexOf("Shell.Application") !== -1) {
            return {
                ShellExecute: function(file, args, dir, operation, showCmd) {
                    if (!file) return;
                    var cleanFile = String(file).trim();
                    try {
                        var electron = (typeof require !== 'undefined') ? (function(){ try { return require('electron'); } catch(e){ return null; } })() : null;
                        if (electron && electron.shell) {
                            if (cleanFile.match(/^https?:\/\//i)) {
                                electron.shell.openExternal(cleanFile);
                                return;
                            } else if (electron.shell.openPath) {
                                electron.shell.openPath(cleanFile);
                                return;
                            }
                        }
                    } catch(eElec) {}

                    try {
                        if (cp && cp.exec) {
                            var isWebUrl = cleanFile.match(/^https?:\/\//i) || cleanFile.match(/^mailto:/i) || cleanFile.match(/^www\./i);
                            if (isWebUrl) {
                                if (cleanFile.match(/^www\./i)) cleanFile = "http://" + cleanFile;
                                cp.exec('start "" "' + cleanFile + '"', { windowsHide: true });
                            } else {
                                cp.exec('start "" "' + cleanFile.replace(/"/g, '""') + '"', { windowsHide: true });
                            }
                            return;
                        }
                    } catch(eCp) {}

                    try {
                        if (typeof window !== "undefined" && window.open) {
                            window.open(cleanFile, '_blank');
                            return;
                        }
                    } catch(eWin) {}
                },
                Open: function(vDir) {
                    if (!vDir) return;
                    var cleanDir = String(vDir).trim();
                    try {
                        var electron = (typeof require !== 'undefined') ? (function(){ try { return require('electron'); } catch(e){ return null; } })() : null;
                        if (electron && electron.shell && electron.shell.openPath) {
                            electron.shell.openPath(cleanDir);
                            return;
                        }
                    } catch(e) {}
                    if (cp && cp.exec) {
                        cp.exec('explorer "' + cleanDir.replace(/"/g, '""') + '"', { windowsHide: true });
                    }
                },
                BrowseForFolder: function(hwnd, title, options, rootFolder) {
                    try {
                        var res = prompt(title || "Inserisci il percorso della cartella:", "C:\\");
                        if (res) {
                            return { Self: { Path: res }, Title: res };
                        }
                    } catch(e) {}
                    return null;
                },
                NameSpace: function(vDir) {
                    return {
                        ParseName: function(sItem) {
                            return {
                                InvokeVerb: function(vVerb) {}
                            };
                        }
                    };
                }
            };
        }

        if (progId === "Word.Application" || progId.indexOf("Word.Application") !== -1) {
            return {
                Visible: false,
                Documents: {
                    Open: function(filePath) {
                        return { Close: function(){}, PrintOut: function(){} };
                    },
                    Add: function() {
                        return { Close: function(){}, SaveAs: function(){} };
                    }
                },
                Quit: function() {}
            };
        }

        if (progId === "WbemScripting.SWbemLocator" || progId.indexOf("SWbemLocator") !== -1) {
            return {
                ConnectServer: function() {
                    return {
                        ExecQuery: function() { return []; }
                    };
                }
            };
        }

        console.warn("ActiveXObject non supportato: " + progId);
        return {};
    };
}

// Polyfill per costanti di VBScript che potrebbero essere usate in JS
window.vbCrLf = "\r\n";
window.vbTab = "\t";

// Sistema Modale Premium Gold Glassmorphism (sostituisce i vecchi confirm/alert grezzi del browser)
window.ShowGoldConfirm = function(title, message, yesText, noText, onConfirm, onCancel, icon) {
    var modalId = "gold-universal-confirm-modal";
    var existing = document.getElementById(modalId);
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

    var overlay = document.createElement("div");
    overlay.id = modalId;
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100vw";
    overlay.style.height = "100vh";
    overlay.style.background = "rgba(5, 8, 15, 0.85)"; // Più scuro e premium
    overlay.style.backdropFilter = "blur(18px)";
    overlay.style.webkitBackdropFilter = "blur(18px)";
    overlay.style.zIndex = "999999";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.opacity = "0";
    overlay.style.transition = "opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1)";

    var box = document.createElement("div");
    box.style.background = "linear-gradient(145deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.98))";
    box.style.border = "1px solid rgba(212, 175, 55, 0.5)";
    box.style.borderRadius = "28px";
    box.style.padding = "40px 45px";
    box.style.width = "480px";
    box.style.maxWidth = "90vw";
    box.style.boxShadow = "0 30px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(212, 175, 55, 0.15), inset 0 1px 0 rgba(255,255,255,0.1)";
    box.style.textAlign = "center";
    box.style.position = "relative";
    box.style.overflow = "hidden";
    box.style.fontFamily = "'Outfit', 'Inter', -apple-system, sans-serif";
    box.style.transform = "scale(0.95) translateY(15px)";
    box.style.transition = "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)";

    var topAccent = document.createElement("div");
    topAccent.style.position = "absolute";
    topAccent.style.top = "0";
    topAccent.style.left = "0";
    topAccent.style.width = "100%";
    topAccent.style.height = "5px";
    topAccent.style.background = "linear-gradient(90deg, transparent, #d4af37, #f1c40f, #38bdf8, #d4af37, transparent)";
    topAccent.style.backgroundSize = "200% 100%";
    topAccent.style.animation = "shimmer 3s infinite linear";
    box.appendChild(topAccent);
    
    // Add keyframes for shimmer if not exists
    if (!document.getElementById("gold-shimmer-style")) {
        var style = document.createElement("style");
        style.id = "gold-shimmer-style";
        style.innerHTML = "@keyframes shimmer { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } } @keyframes pulseGlow { 0% { box-shadow: 0 0 20px rgba(212,175,55,0.2); } 50% { box-shadow: 0 0 40px rgba(212,175,55,0.5); } 100% { box-shadow: 0 0 20px rgba(212,175,55,0.2); } }";
        document.head.appendChild(style);
    }

    var iconCircle = document.createElement("div");
    iconCircle.style.width = "85px";
    iconCircle.style.height = "85px";
    iconCircle.style.borderRadius = "50%";
    iconCircle.style.background = "radial-gradient(circle at center, rgba(212, 175, 55, 0.2), transparent)";
    iconCircle.style.border = "2px solid rgba(212, 175, 55, 0.6)";
    iconCircle.style.color = "#ffe066";
    iconCircle.style.fontSize = "40px";
    iconCircle.style.display = "flex";
    iconCircle.style.alignItems = "center";
    iconCircle.style.justifyContent = "center";
    iconCircle.style.margin = "0 auto 24px auto";
    iconCircle.style.animation = "pulseGlow 3s infinite";
    iconCircle.innerHTML = "&#10024;"; // sparkle by default
    if (icon) {
        // Clean up any garbled text from old calls
        var safeIcon = icon.replace(/[^\x00-\x7F]/g, "&#10024;"); 
        iconCircle.innerHTML = safeIcon;
    }
    box.appendChild(iconCircle);

    var titleEl = document.createElement("h2");
    titleEl.style.fontSize = "22px";
    titleEl.style.fontWeight = "800";
    titleEl.style.color = "#f8fafc";
    titleEl.style.margin = "0 0 16px 0";
    titleEl.style.letterSpacing = "1px";
    titleEl.style.textTransform = "uppercase";
    titleEl.style.textShadow = "0 2px 10px rgba(0,0,0,0.6)";
    titleEl.innerText = title || "CONFERMA";
    box.appendChild(titleEl);

    var msgEl = document.createElement("div");
    msgEl.style.fontSize = "15px";
    msgEl.style.fontWeight = "500";
    msgEl.style.color = "#cbd5e1";
    msgEl.style.lineHeight = "1.7";
    msgEl.style.marginBottom = "35px";
    msgEl.style.padding = "0 15px";
    msgEl.innerHTML = message || "";
    box.appendChild(msgEl);

    var btnContainer = document.createElement("div");
    btnContainer.style.display = "flex";
    btnContainer.style.gap = "18px";
    btnContainer.style.justifyContent = "center";

    var btnYes = document.createElement("button");
    btnYes.style.flex = "1";
    btnYes.style.padding = "16px 20px";
    btnYes.style.background = "linear-gradient(135deg, #d4af37 0%, #b8860b 100%)";
    btnYes.style.color = "#000000";
    btnYes.style.border = "1px solid #ffd700";
    btnYes.style.borderRadius = "16px";
    btnYes.style.fontSize = "14px";
    btnYes.style.fontWeight = "800";
    btnYes.style.letterSpacing = "1px";
    btnYes.style.textTransform = "uppercase";
    btnYes.style.cursor = "pointer";
    btnYes.style.boxShadow = "0 8px 25px rgba(212, 175, 55, 0.4)";
    btnYes.style.transition = "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)";
    btnYes.innerHTML = "&#10004; " + (yesText || "CONFERMA"); // Using Unicode entity for Checkmark
    
    // Assicura che il click sia registrato anche sui figli
    var fireConfirm = function(e) {
        if(e) { e.preventDefault(); e.stopPropagation(); }
        overlay.style.opacity = "0";
        box.style.transform = "scale(0.95) translateY(15px)";
        setTimeout(function() {
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            try {
                if (typeof onConfirm === "function") {
                    onConfirm();
                } else if (title === "CONFERMA USCITA") {
                    // Fallback di sicurezza se onConfirm non c'è
                    window.close();
                }
            } catch(ex) {
                console.error("Errore onConfirm:", ex);
                // Fallback chiusura
                window.close();
            }
        }, 300);
    };
    
    btnYes.onclick = fireConfirm;
    btnYes.ontouchend = fireConfirm;
    
    btnYes.onmouseover = function() { 
        this.style.transform = "translateY(-3px) scale(1.02)"; 
        this.style.boxShadow = "0 12px 30px rgba(212, 175, 55, 0.6)"; 
        this.style.background = "linear-gradient(135deg, #f1c40f 0%, #d4af37 100%)";
    };
    btnYes.onmouseout = function() { 
        this.style.transform = "none"; 
        this.style.boxShadow = "0 8px 25px rgba(212, 175, 55, 0.4)"; 
        this.style.background = "linear-gradient(135deg, #d4af37 0%, #b8860b 100%)";
    };
    
    btnContainer.appendChild(btnYes);

    var btnNo = document.createElement("button");
    btnNo.style.flex = "1";
    btnNo.style.padding = "16px 20px";
    btnNo.style.background = "rgba(255, 255, 255, 0.04)";
    btnNo.style.color = "#e2e8f0";
    btnNo.style.border = "1px solid rgba(255, 255, 255, 0.1)";
    btnNo.style.borderRadius = "16px";
    btnNo.style.fontSize = "14px";
    btnNo.style.fontWeight = "800";
    btnNo.style.letterSpacing = "1px";
    btnNo.style.textTransform = "uppercase";
    btnNo.style.cursor = "pointer";
    btnNo.style.backdropFilter = "blur(10px)";
    btnNo.style.transition = "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)";
    btnNo.innerHTML = "&#10006; " + (noText || "ANNULLA"); // Using Unicode entity for Cross
    
    var fireCancel = function(e) {
        if(e) { e.preventDefault(); e.stopPropagation(); }
        overlay.style.opacity = "0";
        box.style.transform = "scale(0.95) translateY(15px)";
        setTimeout(function() {
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            if (typeof onCancel === "function") onCancel();
        }, 300);
    };
    
    btnNo.onclick = fireCancel;
    btnNo.ontouchend = fireCancel;
    
    btnNo.onmouseover = function() { 
        this.style.background = "rgba(255, 255, 255, 0.12)"; 
        this.style.color = "#ffffff"; 
        this.style.transform = "translateY(-3px)";
        this.style.border = "1px solid rgba(255, 255, 255, 0.25)";
    };
    btnNo.onmouseout = function() { 
        this.style.background = "rgba(255, 255, 255, 0.04)"; 
        this.style.color = "#e2e8f0"; 
        this.style.transform = "none";
        this.style.border = "1px solid rgba(255, 255, 255, 0.1)";
    };
    
    btnContainer.appendChild(btnNo);

    box.appendChild(btnContainer);

    var adminFooter = document.createElement("div");
    adminFooter.innerHTML = "<span style='color:#d4af37; margin-right:6px;'>&#128081;</span><span style='opacity:0.6;'>SYS-ADMIN:</span> <strong style='color:#d4af37; font-weight:800; letter-spacing:1px; margin-left:4px;'>CIRO MILELLA</strong>";
    adminFooter.style.marginTop = "28px";
    adminFooter.style.paddingTop = "18px";
    adminFooter.style.borderTop = "1px solid rgba(255,255,255,0.08)";
    adminFooter.style.fontSize = "10px";
    adminFooter.style.fontWeight = "600";
    adminFooter.style.color = "#94a3b8";
    box.appendChild(adminFooter);

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    // Forza il reflow e avvia l'animazione
    setTimeout(function() {
        overlay.style.opacity = "1";
        box.style.transform = "scale(1) translateY(0)";
    }, 10);
};

window.ShowGoldAlert = function(titleText, msgText, iconEmoji, onOk) {
    if (document.getElementById("gold-confirm-overlay")) {
        var old = document.getElementById("gold-confirm-overlay");
        if (old && old.parentNode) old.parentNode.removeChild(old);
    }
    var overlay = document.createElement("div");
    overlay.id = "gold-confirm-overlay";
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.backgroundColor = "rgba(15, 23, 42, 0.75)";
    overlay.style.backdropFilter = "blur(8px)";
    overlay.style.webkitBackdropFilter = "blur(8px)";
    overlay.style.zIndex = "9999999";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.opacity = "0";
    overlay.style.transition = "opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1)";
    overlay.style.fontFamily = "'Outfit', 'Segoe UI', -apple-system, sans-serif";

    var box = document.createElement("div");
    box.style.background = "linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)";
    box.style.border = "1px solid rgba(212, 175, 55, 0.5)";
    box.style.borderRadius = "20px";
    box.style.padding = "28px 32px";
    box.style.width = "430px";
    box.style.maxWidth = "90%";
    box.style.boxShadow = "0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 30px rgba(212, 175, 55, 0.2)";
    box.style.textAlign = "center";
    box.style.transform = "scale(0.92)";
    box.style.transition = "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)";
    box.style.color = "#f8fafc";

    var iconDiv = document.createElement("div");
    iconDiv.innerHTML = iconEmoji || "â„¹ï¸";
    iconDiv.style.fontSize = "42px";
    iconDiv.style.marginBottom = "14px";
    iconDiv.style.filter = "drop-shadow(0 0 10px rgba(212, 175, 55, 0.5))";
    box.appendChild(iconDiv);

    var title = document.createElement("h3");
    title.innerText = titleText || "INFORMAZIONE";
    title.style.margin = "0 0 12px 0";
    title.style.fontSize = "20px";
    title.style.fontWeight = "800";
    title.style.letterSpacing = "1px";
    title.style.color = "#d4af37";
    title.style.textTransform = "uppercase";
    box.appendChild(title);

    var desc = document.createElement("div");
    desc.innerHTML = msgText || "";
    desc.style.margin = "0 0 26px 0";
    desc.style.fontSize = "15px";
    desc.style.lineHeight = "1.5";
    desc.style.color = "#cbd5e1";
    box.appendChild(desc);

    var btnContainer = document.createElement("div");
    btnContainer.style.display = "flex";
    btnContainer.style.justifyContent = "center";

    var btnOk = document.createElement("button");
    btnOk.innerHTML = "âœ” OK";
    btnOk.style.padding = "12px 36px";
    btnOk.style.background = "linear-gradient(135deg, #d4af37 0%, #aa7c11 100%)";
    btnOk.style.color = "#000000";
    btnOk.style.border = "none";
    btnOk.style.borderRadius = "12px";
    btnOk.style.fontSize = "14px";
    btnOk.style.fontWeight = "800";
    btnOk.style.cursor = "pointer";
    btnOk.style.boxShadow = "0 4px 15px rgba(212, 175, 55, 0.4)";
    btnOk.style.transition = "all 0.2s";
    btnOk.onmouseover = function() { this.style.transform = "translateY(-2px)"; this.style.boxShadow = "0 6px 20px rgba(212, 175, 55, 0.6)"; };
    btnOk.onmouseout = function() { this.style.transform = "none"; this.style.boxShadow = "0 4px 15px rgba(212, 175, 55, 0.4)"; };
    btnOk.onclick = function() {
        overlay.style.opacity = "0";
        box.style.transform = "scale(0.92)";
        setTimeout(function() {
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            if (typeof onOk === "function") onOk();
        }, 200);
    };
    btnContainer.appendChild(btnOk);

    box.appendChild(btnContainer);

    var adminFooter = document.createElement("div");
    adminFooter.innerHTML = "<span style='color:#d4af37; margin-right:4px;'>👑</span><span style='opacity:0.75;'>AMMINISTRATORE DEL PROGETTO:</span> <strong style='color:#d4af37; font-weight:800; letter-spacing:0.5px; margin-left:3px;'>Ciro Milella</strong>";
    adminFooter.style.marginTop = "22px";
    adminFooter.style.paddingTop = "14px";
    adminFooter.style.borderTop = "1px solid rgba(212, 175, 55, 0.25)";
    adminFooter.style.fontSize = "11px";
    adminFooter.style.color = "#94a3b8";
    adminFooter.style.letterSpacing = "0.4px";
    adminFooter.style.textTransform = "uppercase";
    adminFooter.style.fontFamily = "'Outfit', 'Segoe UI', -apple-system, sans-serif";
    box.appendChild(adminFooter);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    setTimeout(function() {
        overlay.style.opacity = "1";
        box.style.transform = "scale(1)";
    }, 10);
};

// Polyfill per window.showModalDialog in ambiente Electron / browser moderni (rimpiazza dialoghi legacy IE/MSHTA)
if (typeof window.showModalDialog === "undefined") {
    window.showModalDialog = function(url, args, features) {
        if (!url) return false;
        var lowerUrl = url.toString().toLowerCase();
        
        // 1. Chiusura con USB (usb_prompt.html)
        if (lowerUrl.indexOf("usb_prompt.html") > -1) {
            var driveLetter = (typeof args === "string" && args) ? args : "D:";
            var sync = window.confirm("Rilevata Chiavetta USB (" + driveLetter + "). Vuoi allineare e sincronizzare automaticamente i dati prima di uscire?");
            if (sync) {
                try {
                    var fso = new ActiveXObject("Scripting.FileSystemObject");
                    var shell = new ActiveXObject("WScript.Shell");
                    var loc = window.location.pathname;
                    if(loc.indexOf("/") === 0) loc = loc.substring(1);
                    loc = decodeURIComponent(loc).replace(/\//g, "\\");
                    var currFolder = fso.GetParentFolderName(loc);
                    var parFolder = fso.GetParentFolderName(currFolder);
                    var rootFolder = fso.GetParentFolderName(parFolder);
                    var batPath = fso.BuildPath(rootFolder, "0_ALLINEA_CHIAVETTA.bat");
                    if (!fso.FileExists(batPath)) {
                        batPath = fso.BuildPath(parFolder, "0_ALLINEA_CHIAVETTA.bat");
                    }
                    if (fso.FileExists(batPath)) {
                        shell.Run('cmd.exe /c "' + batPath + '" ' + driveLetter, 1, true);
                    }
                } catch(e) {}
            }
            return sync;
        }
        
        // 2. Finestre di conferma (premium_confirm.html)
        if (lowerUrl.indexOf("premium_confirm.html") > -1) {
            var msg = "Confermi l'operazione?";
            if (args && args.msg) {
                msg = args.msg.replace(/<[^>]*>?/gm, ''); // Rimuovi tag HTML per un confirm() pulito
            } else if (typeof args === "string") {
                msg = args;
            }
            return window.confirm(msg);
        }
        
        // 3. Finestre di prompt (premium_prompt.html)
        if (lowerUrl.indexOf("premium_prompt.html") > -1) {
            var msg = "Inserisci il valore richiesto:";
            var defVal = "";
            if (args && args.msg) {
                msg = args.msg.replace(/<[^>]*>?/gm, '');
            } else if (typeof args === "string") {
                msg = args;
            }
            if (args && args.defaultValue) defVal = args.defaultValue;
            return window.prompt(msg, defVal);
        }
        
        // 4. Fallback generico
        return window.confirm("Confermi l'operazione?");
    };
}

// Polyfill per la chiusura finestra intelligente in ambiente Electron:
// Qualsiasi chiamata a window.close() o ActionEsci() da una maschera secondaria (Consegne, Anagrafica, ecc.)
// reindirizza l'applicazione alla Dashboard anzichÃ© chiudere la finestra di Electron.
(function() {
    var _origClose = window.close;
    var isElectron = (typeof process !== "undefined" && process.versions && process.versions.electron) ||
                     (typeof window !== "undefined" && window.navigator && window.navigator.userAgent.indexOf("Electron") > -1) ||
                     (typeof require === "function");

    window.close = function() {
        try {
            if (isElectron) {
                if (window._isNavigatingInternal) {
                    return;
                }

                var href = window.location.href || "";
                var parts = href.split("/");
                var page = parts[parts.length - 1].split("?")[0].toLowerCase();
                
                var isDashboard = (page === "dashboard.html" || page === "index.html" || page === "" || page === "login.html");
                
                if (!isDashboard) {
                    window.onbeforeunload = null;
                    if (typeof ALLOW_CLOSE !== "undefined") ALLOW_CLOSE = true;
                    window._isNavigatingInternal = true;
                    window.isNavigating = true;
                    window.isClosing = true;
                    
                    // 1. Se siamo all'interno del portale principale (index.html), notifica o apri il modulo dashboard
                    if (typeof window.ApriModulo === "function") {
                        window.ApriModulo("dashboard.html");
                        return;
                    }
                    if (window.parent && typeof window.parent.ApriModulo === "function") {
                        window.parent.ApriModulo("dashboard.html");
                        return;
                    }
                    if (window.top && typeof window.top.ApriModulo === "function") {
                        window.top.ApriModulo("dashboard.html");
                        return;
                    }

                    // 2. Se siamo in una finestra pop-up separata in Electron, chiudi la finestra secondaria
                    if (window.opener) {
                        try {
                            var electron = require('electron');
                            if (electron && electron.ipcRenderer) {
                                electron.ipcRenderer.send('show-parent');
                                return;
                            }
                        } catch(ePop) {}
                        _origClose.call(window);
                        return;
                    }

                    // 3. Se invece la finestra principale ha navigato direttamente, ricarica l'interfaccia Pannello Riepilogativo
                    var targetPage = (window.location.pathname.toLowerCase().indexOf("file_sistema") > -1) ? "dashboard.html" : "File_Sistema/dashboard.html";
                    window.location.href = targetPage;
                    return;
                }
            }
        } catch(e) {}
        
        _origClose.call(window);
    };

    // Override dinamico per NavigaModulo in Electron per evitare l'uso di mshta.exe e chiusura finestra
    if (isElectron) {
        Object.defineProperty(window, 'NavigaModulo', {
            get: function() {
                return function(modulo) {
                    if (typeof CheckUnsavedChanges === "function" && !CheckUnsavedChanges()) return;
                    window.onbeforeunload = null;
                    if (typeof ALLOW_CLOSE !== "undefined") ALLOW_CLOSE = true;
                    window.isNavigating = true;
                    window.isClosing = true;

                    if (window.parent && typeof window.parent.ApriModulo === "function" && window.parent !== window) {
                        window.parent.ApriModulo(modulo);
                        return;
                    }
                    if (window.top && typeof window.top.ApriModulo === "function" && window.top !== window) {
                        window.top.ApriModulo(modulo);
                        return;
                    }

                    window.location.href = modulo;
                };
            },
            set: function(val) {
                // Ignora l'assegnamento per mantenere la navigazione interna di Electron
            },
            configurable: true
        });
    }

    // Registratore di Log degli Errori JavaScript in Electron
    if (isElectron) {
        window.addEventListener('error', function(event) {
            try {
                var fsNode = require('fs');
                var pathNode = require('path');
                
                var msg = event.message || event.error;
                var url = event.filename || "";
                var line = event.lineno || 0;
                var col = event.colno || 0;
                var errorStack = event.error && event.error.stack ? event.error.stack : "";
                
                var parts = url.split("/");
                var filename = parts[parts.length - 1] || url;
                
                var timestamp = new Date().toISOString();
                var logMsg = "[" + timestamp + "] Errore: " + msg + "\n" +
                             "    File: " + filename + " (Riga: " + line + ", Colonna: " + col + ")\n" +
                             "    Stack: " + errorStack + "\n" +
                             "--------------------------------------------------------------------------------\n";
                
                var pathname = window.location.pathname;
                if (pathname.charAt(0) === "/") pathname = pathname.substring(1);
                var currentFolder = pathNode.dirname(decodeURIComponent(pathname));
                
                var logsFolder = "";
                if (currentFolder.toLowerCase().indexOf("file_sistema") > -1) {
                    var fsIndex = currentFolder.toLowerCase().indexOf("file_sistema");
                    var rootPart = currentFolder.substring(0, fsIndex);
                    logsFolder = pathNode.join(rootPart, "File_Sistema", "Logs");
                } else {
                    logsFolder = pathNode.join(currentFolder, "File_Sistema", "Logs");
                }
                
                if (!fsNode.existsSync(logsFolder)) {
                    fsNode.mkdirSync(logsFolder, { recursive: true });
                }
                
                var logFile = pathNode.join(logsFolder, "js_errors.log");
                fsNode.appendFileSync(logFile, logMsg, 'utf8');
            } catch(e) {}
        });
    }
})();

// ============================================================================
// UNIVERSAL GOLD WATERMARK & FOOTER BADGE - "PROGETTO REALIZZATO DA CIRO MILELLA"
// ============================================================================
(function() {
    function InserisciBadgeMilella() {
        try {
            if (window.innerWidth < 200 || window.innerHeight < 150) return;
            var path = (window.location.pathname || "").toLowerCase();
            var isPopupWindow = (path.indexOf("premium_") > -1 || path.indexOf("prompt") > -1 || path.indexOf("scegli_icona") > -1 || window.innerWidth < 650 || window.innerHeight < 450);

            var existingBadge = document.getElementById("milella-signature-badge");
            var existingFooter = document.getElementById("milella-popup-footer");

            if (isPopupWindow) {
                if (existingBadge) existingBadge.remove();
                if (existingFooter) existingFooter.remove();
                return;
            } else {
                if (existingFooter) {
                    existingFooter.remove();
                    if (document.body) document.body.style.paddingBottom = "";
                }
                if (existingBadge) return;

                var badge = document.createElement("div");
                badge.id = "milella-signature-badge";
                badge.style.position = "fixed";
                badge.style.bottom = "12px";
                badge.style.left = "18px";
                badge.style.zIndex = "999990";
                badge.style.background = "linear-gradient(135deg, rgba(15, 23, 42, 0.90) 0%, rgba(30, 41, 59, 0.90) 100%)";
                badge.style.border = "1px solid rgba(212, 175, 55, 0.5)";
                badge.style.borderRadius = "30px";
                badge.style.padding = "6px 16px";
                badge.style.display = "flex";
                badge.style.alignItems = "center";
                badge.style.gap = "8px";
                badge.style.boxShadow = "0 4px 15px rgba(0, 0, 0, 0.4), 0 0 12px rgba(212, 175, 55, 0.15)";
                badge.style.backdropFilter = "blur(10px)";
                badge.style.webkitBackdropFilter = "blur(10px)";
                badge.style.fontFamily = "'Outfit', 'Inter', -apple-system, sans-serif";
                badge.style.fontSize = "11px";
                badge.style.fontWeight = "600";
                badge.style.color = "#e2e8f0";
                badge.style.letterSpacing = "0.5px";
                // Posizione salvata da localStorage se disponibile
                try {
                    var savedPos = localStorage.getItem("milellaBadgePosition");
                    if (savedPos) {
                        var pos = JSON.parse(savedPos);
                        if (pos && typeof pos.left === "number" && typeof pos.top === "number") {
                            badge.style.left = pos.left + "px";
                            badge.style.top = pos.top + "px";
                            badge.style.bottom = "auto";
                        }
                    }
                } catch(eLoc) {}

                badge.style.cursor = "grab";
                badge.style.touchAction = "none";
                badge.title = "Trascina per spostare | Clicca per informazioni sulla licenza e sviluppo software";

                var isDragging = false;
                var dragStartX = 0, dragStartY = 0, badgeStartX = 0, badgeStartY = 0;
                var hasMoved = false;

                badge.onmousedown = function(e) {
                    e = e || window.event;
                    isDragging = true;
                    hasMoved = false;
                    dragStartX = e.clientX;
                    dragStartY = e.clientY;
                    
                    var rect = badge.getBoundingClientRect();
                    badgeStartX = rect.left;
                    badgeStartY = rect.top;
                    
                    badge.style.cursor = "grabbing";
                    badge.style.transition = "none";
                    badge.style.zIndex = "999999";
                    
                    if (e.preventDefault) e.preventDefault();
                    return false;
                };

                badge.ontouchstart = function(e) {
                    if (!e.touches || e.touches.length !== 1) return;
                    var touch = e.touches[0];
                    isDragging = true;
                    hasMoved = false;
                    dragStartX = touch.clientX;
                    dragStartY = touch.clientY;
                    
                    var rect = badge.getBoundingClientRect();
                    badgeStartX = rect.left;
                    badgeStartY = rect.top;
                    
                    badge.style.transition = "none";
                    badge.style.zIndex = "999999";
                };

                var onMove = function(e) {
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
                    
                    var newLeft = badgeStartX + deltaX;
                    var newTop = badgeStartY + deltaY;
                    
                    var maxLeft = window.innerWidth - badge.offsetWidth - 5;
                    var maxTop = window.innerHeight - badge.offsetHeight - 5;
                    
                    if (newLeft < 5) newLeft = 5;
                    if (newLeft > maxLeft) newLeft = maxLeft;
                    if (newTop < 5) newTop = 5;
                    if (newTop > maxTop) newTop = maxTop;
                    
                    badge.style.left = newLeft + "px";
                    badge.style.top = newTop + "px";
                    badge.style.bottom = "auto";
                    
                    if (e.touches && e.preventDefault) e.preventDefault();
                };

                var onEnd = function(e) {
                    if (!isDragging) return;
                    isDragging = false;
                    badge.style.cursor = "grab";
                    badge.style.transition = "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)";
                    
                    if (hasMoved) {
                        var rect = badge.getBoundingClientRect();
                        try {
                            localStorage.setItem("milellaBadgePosition", JSON.stringify({ left: rect.left, top: rect.top }));
                        } catch(eLoc) {}
                    }
                };

                if (document.addEventListener) {
                    document.addEventListener("mousemove", onMove, false);
                    document.addEventListener("mouseup", onEnd, false);
                    document.addEventListener("touchmove", onMove, { passive: false });
                    document.addEventListener("touchend", onEnd, false);
                } else if (document.attachEvent) {
                    document.attachEvent("onmousemove", onMove);
                    document.attachEvent("onmouseup", onEnd);
                }

                badge.onmouseover = function() {
                    if (isDragging) return;
                    this.style.transform = "translateY(-2px) scale(1.03)";
                    this.style.borderColor = "rgba(212, 175, 55, 0.9)";
                    this.style.boxShadow = "0 6px 20px rgba(0, 0, 0, 0.6), 0 0 20px rgba(212, 175, 55, 0.35)";
                    this.style.opacity = "1";
                };
                badge.onmouseout = function() {
                    if (isDragging) return;
                    this.style.transform = "none";
                    this.style.borderColor = "rgba(212, 175, 55, 0.5)";
                    this.style.boxShadow = "0 4px 15px rgba(0, 0, 0, 0.4), 0 0 12px rgba(212, 175, 55, 0.15)";
                    this.style.opacity = "0.92";
                };
                badge.onclick = function() {
                    if (hasMoved) return;
                    if (typeof window.ShowGoldAlert === "function") {
                        window.ShowGoldAlert("CREDITI E LICENZA", "<b>SISTEMA LOGISTICA ENTERPRISE GOLD</b><br><br>Ideazione, Architettura, Design e Sviluppo Software interamente realizzati da <b style='color:#d4af37; font-size:16px;'>Ciro Milella</b>.<br><br><span style='font-size:12px; opacity:0.8;'>Tutti i diritti riservati Â© 2026 - Edizione Lusso Gold</span>", "👑");
                    } else {
                        alert("SISTEMA LOGISTICA ENTERPRISE GOLD\n\nProgetto Realizzato da CIRO MILELLA\nTutti i diritti riservati Â© 2026");
                    }
                };

                var icon = document.createElement("span");
                icon.innerHTML = "👑";
                icon.style.fontSize = "13px";
                icon.style.filter = "drop-shadow(0 0 4px rgba(212, 175, 55, 0.6))";
                badge.appendChild(icon);

                var text = document.createElement("span");
                text.innerHTML = "PROGETTO REALIZZATO DA <strong style='color:#d4af37; font-weight:800; text-transform:uppercase; letter-spacing:0.8px; margin-left:3px;'>Ciro Milella</strong>";
                badge.appendChild(text);

                if (document.body) {
                    document.body.appendChild(badge);
                }
            }
        } catch(e) {}
    }

    function addEvent(el, event, fn) {
        if (el.addEventListener) {
            el.addEventListener(event, fn, false);
        } else if (el.attachEvent) {
            el.attachEvent("on" + event, fn);
        } else {
            el["on" + event] = fn;
        }
    }

    if (document.readyState === "complete" || document.readyState === "interactive") {
        setTimeout(InserisciBadgeMilella, 100);
    } else {
        addEvent(window, "DOMContentLoaded", function() { setTimeout(InserisciBadgeMilella, 100); });
        addEvent(window, "load", function() { setTimeout(InserisciBadgeMilella, 100); });
    }

    addEvent(window, "resize", function() {
        InserisciBadgeMilella();
    });
})();



// --- UNIVERSAL CYBER LOCK (LOCKED SCREEN ON IDLE) ---
(function(){
    var cyberLockIdleTime = 0;
    var cyberLockIsLocked = false;
    
    function resetCyberLockIdle() {
        if (!cyberLockIsLocked) cyberLockIdleTime = 0;
    }

    if (typeof window !== 'undefined' && document) {
        var addEvt = function(el, evt, fn) {
            if (el.addEventListener) {
                el.addEventListener(evt, fn, true);
            } else if (el.attachEvent) {
                el.attachEvent('on' + evt, fn);
            } else {
                el['on' + evt] = fn;
            }
        };

        addEvt(window, 'mousemove', resetCyberLockIdle);
        addEvt(window, 'keydown', resetCyberLockIdle);
        addEvt(window, 'mousedown', resetCyberLockIdle);
        addEvt(window, 'touchstart', resetCyberLockIdle);
        addEvt(window, 'scroll', resetCyberLockIdle);
        if (document.body) {
            addEvt(document.body, 'mousemove', resetCyberLockIdle);
            addEvt(document.body, 'keydown', resetCyberLockIdle);
            addEvt(document.body, 'mousedown', resetCyberLockIdle);
        }
        
        window.SbloccaCyberLock = function(pinUtente) {
            var cp = "1234";
            try { cp = window.top.localStorage.getItem("cyberLockPassword") || localStorage.getItem("cyberLockPassword") || "1234"; } catch(e) { cp = localStorage.getItem("cyberLockPassword") || "1234"; }
            
            var debugInfo = "SbloccaCyberLock started. Initial cp: " + cp + "\n";
            
            // FSO/Node Fallback to read from file
            try {
                if (typeof require !== 'undefined') {
                    debugInfo += "Using Node.js require.\n";
                    var nfs = require('fs');
                    var npath = require('path');
                    var basePath = (typeof __dirname !== 'undefined') ? __dirname : require('process').cwd();
                    debugInfo += "basePath: " + basePath + "\n";
                    var pFile = "";
                    for(var i=0; i<5; i++) {
                        var check1 = npath.join(basePath, "cyber_lock_pwd.txt");
                        var check2 = npath.join(basePath, "File_Sistema", "cyber_lock_pwd.txt");
                        debugInfo += "Checking " + check1 + " -> " + nfs.existsSync(check1) + "\n";
                        debugInfo += "Checking " + check2 + " -> " + nfs.existsSync(check2) + "\n";
                        if(nfs.existsSync(check1)) { pFile = check1; break; }
                        if(nfs.existsSync(check2)) { pFile = check2; break; }
                        var parent = npath.dirname(basePath);
                        if(parent === basePath) break;
                        basePath = parent;
                    }
                    if (pFile && nfs.existsSync(pFile)) {
                        debugInfo += "Found file: " + pFile + "\n";
                        var filePwd = nfs.readFileSync(pFile, 'utf8').replace(/^\s+|\s+$/g, '');
                        debugInfo += "File content: '" + filePwd + "'\n";
                        if (filePwd !== "") {
                            cp = filePwd;
                            debugInfo += "Updated cp to: " + cp + "\n";
                        }
                    } else {
                        debugInfo += "File not found in Node fallback.\n";
                    }
                } else if (typeof ActiveXObject !== 'undefined') {
                    debugInfo += "Using ActiveXObject.\n";
                    var fsoLock = new ActiveXObject("Scripting.FileSystemObject");
                    var loc = document.location.pathname ? decodeURIComponent(document.location.pathname).replace(/^\//, "").replace(/\//g, "\\") : "";
                    var dir = fsoLock.GetParentFolderName(loc);
                    var pwdFileHTA = "";
                    for(var i=0; i<5; i++) {
                        if(!dir) break;
                        var check1 = fsoLock.BuildPath(dir, "cyber_lock_pwd.txt");
                        var check2 = fsoLock.BuildPath(dir, "File_Sistema\\cyber_lock_pwd.txt");
                        if(fsoLock.FileExists(check1)) { pwdFileHTA = check1; break; }
                        if(fsoLock.FileExists(check2)) { pwdFileHTA = check2; break; }
                        dir = fsoLock.GetParentFolderName(dir);
                    }
                    if (pwdFileHTA && fsoLock.FileExists(pwdFileHTA)) {
                        var tsLock = fsoLock.OpenTextFile(pwdFileHTA, 1);
                        var filePwd = tsLock.ReadAll().replace(/^\s+|\s+$/g, '');
                        tsLock.Close();
                        if (filePwd !== "") cp = filePwd;
                    }
                }
            } catch(e) {
                debugInfo += "Error in fallback: " + e.message + "\n";
            }

            try {
                localStorage.setItem("debugLockLog", debugInfo);
            } catch(e) {}

            try {
                if (typeof require !== 'undefined') {
                    require('fs').writeFileSync(require('path').join(require('process').cwd(), 'debug_lock.txt'), debugInfo, 'utf8');
                }
            } catch(e) {}

            if (pinUtente === cp) {
                document.getElementById("universalCyberLock").style.display="none";
                window.cyberLockIsLocked=false;
            } else {
                alert("PIN Errato!\n\n-- INFO TECNICHE --\n" + debugInfo);
                document.getElementById("universalCyberPin").value="";
            }
        };

        window.ShowUniversalCyberLock = function() {
            var l = document.getElementById('universalCyberLock');
            if (!l) {
                l = document.createElement('div');
                l.id = 'universalCyberLock';
                l.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:linear-gradient(135deg, #0f172a 0%, #080c14 100%); z-index:2147483647; display:flex; flex-direction:column; align-items:center; justify-content:center; font-family:\'Segoe UI\', sans-serif;';
                l.innerHTML = '<h1 style=\'color:#f3e5ab; font-size:36px; margin-bottom:10px; text-transform:uppercase; letter-spacing:2px;\'>🔒 Schermo Bloccato</h1>' +
                              '<p style=\'color:#cbd5e1; font-size:16px; margin-bottom:30px;\'>Sistema protetto per inattività. Inserisci il codice per sbloccare.</p>' +
                              '<input type=\'password\' id=\'universalCyberPin\' placeholder=\'****\' style=\'width:200px; padding:15px; font-size:24px; text-align:center; border-radius:8px; border:2px solid #334155; background:rgba(15,23,42,0.8); color:#fff; outline:none; margin-bottom:20px;\' onkeydown=\'if(event.keyCode===13 || event.key===\"Enter\") document.getElementById(\"btnUniversalUnlock\").click();\'>' +
                              '<button id=\'btnUniversalUnlock\' style=\'background:linear-gradient(135deg, #d4af37 0%, #b8860b 100%); color:#0b0f19; font-weight:bold; border:none; padding:15px 40px; border-radius:8px; cursor:pointer; font-size:16px; text-transform:uppercase; box-shadow:0 4px 15px rgba(212,175,55,0.3);\' onclick=\'if(typeof window.SbloccaCyberLock === \"function\") { window.SbloccaCyberLock(document.getElementById(\"universalCyberPin\").value); } else { document.getElementById(\"universalCyberLock\").style.display=\"none\"; window.cyberLockIsLocked=false; }\'>SBLOCCA SISTEMA</button>';
                document.body.appendChild(l);
            }
            l.style.display = 'flex';
            var input = document.getElementById('universalCyberPin');
            if (input) {
                input.value = '';
                setTimeout(function(){ input.focus(); }, 100);
            }
            if (typeof Parla === 'function') Parla('Sistema bloccato. Inserire password.');
        };

        setInterval(function() {
            var l = document.getElementById('universalCyberLock');
            if (l && l.style.display === 'flex') {
                cyberLockIsLocked = true;
                cyberLockIdleTime = 0;
                window.cyberLockIsLocked = true;
                return;
            } else {
                cyberLockIsLocked = false;
                window.cyberLockIsLocked = false;
            }
            
            var timeoutMinuti = 15;
            try {
                var lsVal = localStorage.getItem('idleTimeoutMinutes');
                if (lsVal !== null && lsVal !== undefined) {
                    var parsedLs = parseInt(lsVal, 10);
                    if (!isNaN(parsedLs) && parsedLs > 0) timeoutMinuti = parsedLs;
                }
            } catch(e) {}
            
            // Ripristinato timer normale in base alle impostazioni utente
            var timeoutSecondi = timeoutMinuti * 60;
            
            cyberLockIdleTime++;
            
            if (cyberLockIdleTime >= timeoutSecondi) {
                cyberLockIdleTime = 0;
                cyberLockIsLocked = true;
                window.ShowUniversalCyberLock();
            }
        }, 1000);
    }
})();

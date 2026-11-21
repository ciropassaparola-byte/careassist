Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' 1. Trova il percorso del progetto
scriptPath = WScript.ScriptFullName
utilsDir = fso.GetParentFolderName(scriptPath)
projectDir = fso.GetParentFolderName(utilsDir)
psScript = fso.BuildPath(utilsDir, "crea_ico_sistema.ps1")

' 2. Esegui lo script PowerShell in modalità nascosta o con prompt
MsgBox "Sto configurando le icone ufficiali del sistema C.M. Clicca OK e attendi qualche istante.", vbInformation, "Configurazione Icone"

' Esegui PowerShell bypassando le restrizioni di esecuzione
command = "powershell -ExecutionPolicy Bypass -File """ & psScript & """"
shell.Run command, 1, True

' 3. Controlla se il file è stato creato
icoFile = fso.BuildPath(fso.BuildPath(projectDir, "assets\img"), "app_icon_cm.ico")
If fso.FileExists(icoFile) Then
    MsgBox "L'icona e' stata creata correttamente!" & vbCrLf & _
           "Per vederla nella barra delle applicazioni, chiudi il programma e riaprilo." & vbCrLf & vbCrLf & _
           "NOTA: Se avevi 'Aggiunto' (Pinned) il programma alla barra, dovrai rimuoverlo e aggiungerlo di nuovo.", vbInformation, "Successo!"
Else
    MsgBox "Non e' stato possibile creare il file icona automaticamente." & vbCrLf & _
           "Controlla che lo script 'crea_ico_sistema.ps1' sia presente nella cartella utils.", vbCritical, "Errore"
End If

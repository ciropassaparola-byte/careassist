using System;
using System.IO;
using System.Text;
using System.Diagnostics;
using System.Reflection;

namespace CareAssistPro
{
    class Program
    {
        static void Main(string[] args)
        {
            try
            {
                // Avvia usando la cartella del file corrente (Desktop) e il profilo fisso del Desktop
                string appDir = AppDomain.CurrentDomain.BaseDirectory.TrimEnd('\\');
                string htmlPath = Path.Combine(appDir, "index.html");
                string profileDir = Path.Combine(appDir, ".app_profile");

                // Se per caso lanciato altrove o index.html non presente, fallback su Standalone
                if (!File.Exists(htmlPath))
                {
                    string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                    string targetDir = Path.Combine(localAppData, "CareAssist_Pro_Standalone");
                    Directory.CreateDirectory(targetDir);
                    ExtractResource("CareAssistPro.index.html", Path.Combine(targetDir, "index.html"));
                    ExtractResource("CareAssistPro.app.js", Path.Combine(targetDir, "app.js"));
                    ExtractResource("CareAssistPro.style.css", Path.Combine(targetDir, "style.css"));
                    htmlPath = Path.Combine(targetDir, "index.html");
                    profileDir = Path.Combine(targetDir, "profile_data");
                }

                Directory.CreateDirectory(profileDir);

                // Avvio automatico server Smartphone/Tablet in background senza finestra
                try
                {
                    string serverJs = Path.Combine(appDir, "server_smartphone.js");
                    if (File.Exists(serverJs))
                    {
                        ProcessStartInfo psiServer = new ProcessStartInfo();
                        psiServer.FileName = "node.exe";
                        psiServer.Arguments = "\"" + serverJs + "\"";
                        psiServer.CreateNoWindow = true;
                        psiServer.UseShellExecute = false;
                        psiServer.WindowStyle = ProcessWindowStyle.Hidden;
                        Process.Start(psiServer);
                    }
                }
                catch { }

                string fileUri = "file:///" + htmlPath.Replace('\\', '/');

                string browserExe = null;
                string brave = @"C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe";
                string edge1 = @"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe";
                string edge2 = @"C:\Program Files\Microsoft\Edge\Application\msedge.exe";
                string chrome = @"C:\Program Files\Google\Chrome\Application\chrome.exe";

                if (File.Exists(brave)) browserExe = brave;
                else if (File.Exists(edge1)) browserExe = edge1;
                else if (File.Exists(edge2)) browserExe = edge2;
                else if (File.Exists(chrome)) browserExe = chrome;

                if (browserExe != null)
                {
                    string arguments = string.Format("--app=\"{0}\" --user-data-dir=\"{1}\" --start-maximized --disable-translate --disable-features=TranslateUI", fileUri, profileDir);
                    ProcessStartInfo psi = new ProcessStartInfo();
                    psi.FileName = browserExe;
                    psi.Arguments = arguments;
                    psi.UseShellExecute = false;
                    Process.Start(psi);
                }
                else
                {
                    Process.Start(fileUri);
                }
            }
            catch (Exception ex)
            {
                System.Windows.Forms.MessageBox.Show("Errore durante l'avvio di CareAssist Pro:\n\n" + ex.Message, "CareAssist Pro - Errore", System.Windows.Forms.MessageBoxButtons.OK, System.Windows.Forms.MessageBoxIcon.Hand);
            }
        }

        private static void ExtractResource(string resourceName, string outputPath)
        {
            Assembly executingAssembly = Assembly.GetExecutingAssembly();
            using (Stream manifestResourceStream = executingAssembly.GetManifestResourceStream(resourceName))
            {
                if (manifestResourceStream != null)
                {
                    using (FileStream fileStream = new FileStream(outputPath, FileMode.Create, FileAccess.Write))
                    {
                        manifestResourceStream.CopyTo(fileStream);
                    }
                }
            }
        }
    }
}
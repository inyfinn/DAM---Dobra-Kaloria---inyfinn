package main

import (
	"fmt"
	"os"
	"path/filepath"
	"syscall"
	"unsafe"
)

const appTitle = "DAM - Dobra Kaloria - Inyfinn"

var (
	user32           = syscall.NewLazyDLL("user32.dll")
	procMessageBoxW  = user32.NewProc("MessageBoxW")
	advapi32         = syscall.NewLazyDLL("advapi32.dll")
	procRegOpenKeyEx = advapi32.NewProc("RegOpenKeyExW")
	procRegCloseKey  = advapi32.NewProc("RegCloseKey")
)

func showHeal(reason string, gitRoot string, ipc IPCNames) {
	text := healText(reason, gitRoot, ipc)
	showMessageBox(text)
}

func showMessageBox(text string) {
	title, _ := syscall.UTF16PtrFromString(appTitle)
	body, _ := syscall.UTF16PtrFromString(text)
	procMessageBoxW.Call(0, uintptr(unsafe.Pointer(body)), uintptr(unsafe.Pointer(title)), 0x40)
}

func healText(reason string, gitRoot string, ipc IPCNames) string {
	runtime := filepath.Join(gitRoot, filepath.FromSlash(ipc.RuntimePythonRel))
	switch reason {
	case "missing_runtime":
		return fmt.Sprintf(
			"Brak silnika w folderze aplikacji.\n\nOczekiwany plik:\n%s\n\nSkopiuj kompletny folder DAM (z bin\\runtime\\win) albo skontaktuj sie z IT.\nNie trzeba instalowac Pythona.",
			runtime,
		)
	case "missing_launch":
		launch := filepath.Join(gitRoot, filepath.FromSlash(ipc.LaunchPyRel))
		return fmt.Sprintf("Uszkodzona instalacja: brak launch.py.\n\nSzukano w:\n%s", launch)
	case "missing_engine":
		engine := filepath.Join(gitRoot, filepath.FromSlash(ipc.EngineDirRel), ipc.EngineExeName)
		return fmt.Sprintf("Brak silnika aplikacji.\n\nOczekiwany:\n%s\n\nUruchom ponowna instalacje portable.", engine)
	case "webview2":
		return "Brak Microsoft Edge WebView2 Runtime.\n\nPobierz Evergreen Bootstrapper:\nhttps://go.microsoft.com/fwlink/p/?LinkId=2124703"
	case "vcredist":
		return "Brak bibliotek Microsoft Visual C++ Runtime (x64).\n\nZainstaluj vc_redist.x64.exe z pakietu DAM lub pobierz z Microsoft."
	case "corrupt_manifest":
		return "Uszkodzony manifest instalacji.\n\nPobierz ponownie portable ZIP i rozpakuj do nowego folderu."
	case "network":
		return "Brak polaczenia sieciowego.\n\nDAM dziala offline, ale synchronizacja z Synology wymaga sieci."
	case "db_config":
		return "Brak poprawnej konfiguracji bazy danych.\n\nSkopiuj dam-connection.env.example i uzupelnij (bez hasla w git)."
	default:
		return fmt.Sprintf("Nie udalo sie uruchomic DAM.\nPowod: %s", reason)
	}
}

func hasWebView2() bool {
	if os.Getenv("DAM_SKIP_WEBVIEW2_CHECK") == "1" {
		return true
	}
	paths := []string{
		`SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00B3D36F16C8}`,
		`SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00B3D36F16C8}`,
	}
	const hklm = 0x80000002
	for _, sub := range paths {
		subPtr, _ := syscall.UTF16PtrFromString(sub)
		var h syscall.Handle
		r, _, _ := procRegOpenKeyEx.Call(uintptr(hklm), uintptr(unsafe.Pointer(subPtr)), 0, 0x20019, uintptr(unsafe.Pointer(&h)))
		if r == 0 {
			procRegCloseKey.Call(uintptr(h))
			return true
		}
	}
	pv := os.Getenv("ProgramFiles(x86)")
	if pv != "" {
		eb := filepath.Join(pv, "Microsoft", "EdgeWebView", "Application")
		if st, err := os.Stat(eb); err == nil && st.IsDir() {
			return true
		}
	}
	return false
}

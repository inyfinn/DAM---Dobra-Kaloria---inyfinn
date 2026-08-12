package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"time"
)

func main() {
	gitRoot := findGitRoot()
	if gitRoot == "" {
		showMessageBox("Nie mozna ustalic folderu aplikacji DAM.")
		os.Exit(1)
	}
	ipc := loadIPC(gitRoot)

	mh, acquired, err := acquireBootstrapMutex(ipc.MutexBootstrap)
	if err != nil {
		showHeal("bootstrap_mutex", gitRoot, ipc)
		os.Exit(1)
	}
	if !acquired {
		signalActivate(ipc.EventActivate)
		procCloseHandle.Call(uintptr(mh))
		os.Exit(0)
	}
	defer procCloseHandle.Call(uintptr(mh))

	if reason := preflight(gitRoot, ipc); reason != "" {
		showHeal(reason, gitRoot, ipc)
		os.Exit(1)
	}

	nonce := randomNonce(16)
	pipeName, pipe, err := createHandshakePipe(ipc.PipeHandshakePrefix, nonce)
	if err != nil {
		showMessageBox("Nie udalo sie utworzyc kanalu handshake.\n\n" + err.Error())
		os.Exit(1)
	}
	defer procCloseHandle.Call(uintptr(pipe))

	if err := spawnEngine(gitRoot, ipc, pipeName, nonce); err != nil {
		if err.Error() == "missing_engine" {
			showHeal("missing_engine", gitRoot, ipc)
		} else {
			showMessageBox("Nie udalo sie uruchomic silnika.\n\n" + err.Error())
		}
		os.Exit(1)
	}

	if err := waitHandshake(pipe, ipc.HandshakeTimeoutSec); err != nil {
		showMessageBox("Silnik nie odpowiedzial na handshake.\n\n" + err.Error())
		os.Exit(1)
	}

	writeProvenance(gitRoot, ipc, nonce)
	os.Exit(0)
}

func writeProvenance(gitRoot string, ipc IPCNames, nonce string) {
	evDir := filepath.Join(gitRoot, "dist", "evidence")
	_ = os.MkdirAll(evDir, 0o755)
	out := map[string]any{
		"generated_at_utc": time.Now().UTC().Format(time.RFC3339),
		"git_root":         gitRoot,
		"aumid":            ipc.AUMID,
		"handshake_nonce":  nonce,
		"bootstrap":        "go",
		"cgo_enabled":      "0",
	}
	b, _ := json.MarshalIndent(out, "", "  ")
	_ = os.WriteFile(filepath.Join(evDir, "bootstrap-build-provenance.json"), append(b, '\n'), 0o644)
}

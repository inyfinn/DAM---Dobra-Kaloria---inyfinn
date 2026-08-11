package main

import (
	"encoding/json"
	"os"
	"path/filepath"
)

type IPCNames struct {
	AUMID                      string `json:"aumid"`
	MutexBootstrap             string `json:"mutex_bootstrap"`
	MutexEngine                string `json:"mutex_engine"`
	MutexLegacyGlobal          string `json:"mutex_legacy_global"`
	PipeHandshakePrefix        string `json:"pipe_handshake_prefix"`
	EventActivate              string `json:"event_activate"`
	EnvHandshakePipe           string `json:"env_handshake_pipe"`
	EnvHandshakeNonce          string `json:"env_handshake_nonce"`
	EnvGitRoot                 string `json:"env_git_root"`
	ExitBypassWithoutHandshake int    `json:"exit_bypass_without_handshake"`
	HandshakeTimeoutSec        int    `json:"handshake_timeout_sec"`
	EngineExeName              string `json:"engine_exe_name"`
	EngineDirRel               string `json:"engine_dir_rel"`
	RuntimePythonRel           string `json:"runtime_python_rel"`
	LaunchPyRel                string `json:"launch_py_rel"`
}

func defaultIPC() IPCNames {
	return IPCNames{
		AUMID:                      "Inyfinn.DAM.DobraKaloria.1",
		MutexBootstrap:             `Local\DAM_DOBRA_KALORIA_BOOTSTRAP`,
		MutexEngine:                `Local\DAM_DOBRA_KALORIA_ENGINE_SINGLE_INSTANCE`,
		PipeHandshakePrefix:        `\\.\pipe\DAM_DOBRA_KALORIA_HANDSHAKE_`,
		EnvHandshakePipe:           "DAM_HANDSHAKE_PIPE",
		EnvHandshakeNonce:          "DAM_HANDSHAKE_NONCE",
		EnvGitRoot:                 "DAM_GIT_ROOT",
		ExitBypassWithoutHandshake: 17,
		HandshakeTimeoutSec:        60,
		EngineExeName:              "dam-appw.exe",
		EngineDirRel:               `bin\runtime\win\dam-app`,
		RuntimePythonRel:           `bin\runtime\win\python\pythonw.exe`,
		LaunchPyRel:                `bin\apps\desktop\launch.py`,
	}
}

func loadIPC(gitRoot string) IPCNames {
	ipc := defaultIPC()
	candidates := []string{
		filepath.Join(gitRoot, "bin", "apps", "desktop", "ipc_names.json"),
		filepath.Join(gitRoot, "apps", "desktop", "ipc_names.json"),
	}
	for _, p := range candidates {
		b, err := os.ReadFile(p)
		if err != nil {
			continue
		}
		if json.Unmarshal(b, &ipc) == nil {
			break
		}
	}
	if ipc.HandshakeTimeoutSec <= 0 {
		ipc.HandshakeTimeoutSec = 60
	}
	if ipc.ExitBypassWithoutHandshake == 0 {
		ipc.ExitBypassWithoutHandshake = 17
	}
	return ipc
}

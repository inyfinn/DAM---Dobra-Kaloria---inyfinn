package main

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"time"
	"unsafe"
)

var (
	kernel32              = syscall.NewLazyDLL("kernel32.dll")
	procCreateMutexW      = kernel32.NewProc("CreateMutexW")
	procGetLastError      = kernel32.NewProc("GetLastError")
	procCloseHandle       = kernel32.NewProc("CloseHandle")
	procCreateNamedPipeW  = kernel32.NewProc("CreateNamedPipeW")
	procConnectNamedPipe  = kernel32.NewProc("ConnectNamedPipe")
	procReadFile          = kernel32.NewProc("ReadFile")
	procCreateEventW      = kernel32.NewProc("CreateEventW")
	procOpenEventW        = kernel32.NewProc("OpenEventW")
	procSetEvent          = kernel32.NewProc("SetEvent")
)

const (
	errorAlreadyExists = 183
	pipeAccessInbound  = 0x00000001
	pipeTypeByte       = 0x00000000
	pipeWait           = 0x00000000
)

func findGitRoot() string {
	exe, err := os.Executable()
	if err != nil {
		return ""
	}
	dir := filepath.Dir(exe)
	for i := 0; i < 6; i++ {
		if _, err := os.Stat(filepath.Join(dir, "bin")); err == nil {
			return dir
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	return filepath.Dir(exe)
}

func acquireBootstrapMutex(name string) (syscall.Handle, bool, error) {
	namePtr, err := syscall.UTF16PtrFromString(name)
	if err != nil {
		return 0, false, err
	}
	procGetLastError.Call()
	h, _, err := procCreateMutexW.Call(0, 0, uintptr(unsafe.Pointer(namePtr)))
	if h == 0 {
		return 0, false, err
	}
	exists, _, _ := procGetLastError.Call()
	if exists == errorAlreadyExists {
		return syscall.Handle(h), false, nil
	}
	return syscall.Handle(h), true, nil
}

func signalActivate(eventName string) {
	namePtr, _ := syscall.UTF16PtrFromString(eventName)
	h, _, _ := procOpenEventW.Call(0x0002, 0, uintptr(unsafe.Pointer(namePtr)))
	if h != 0 {
		procSetEvent.Call(h)
		procCloseHandle.Call(h)
	}
}

func randomNonce(n int) string {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return fmt.Sprintf("%d", time.Now().UnixNano())
	}
	return hex.EncodeToString(b)
}

func createHandshakePipe(prefix string, nonce string) (string, syscall.Handle, error) {
	pipeName := prefix + nonce
	namePtr, err := syscall.UTF16PtrFromString(pipeName)
	if err != nil {
		return "", 0, err
	}
	h, _, err := procCreateNamedPipeW.Call(
		uintptr(unsafe.Pointer(namePtr)),
		pipeAccessInbound,
		pipeTypeByte|pipeWait,
		1,
		4096,
		4096,
		0,
		0,
	)
	if h == uintptr(syscall.InvalidHandle) {
		return "", 0, fmt.Errorf("CreateNamedPipe: %v", err)
	}
	return pipeName, syscall.Handle(h), nil
}

func waitHandshake(pipe syscall.Handle, timeoutSec int) error {
	done := make(chan error, 1)
	go func() {
		_, _, err := procConnectNamedPipe.Call(uintptr(pipe), 0)
		if err != nil && err != syscall.Errno(0) && !strings.Contains(err.Error(), "The operation completed successfully") {
			// ConnectNamedPipe may return ERROR_PIPE_CONNECTED (535) which is OK
		}
		buf := make([]byte, 64)
		var read uint32
		ok, _, err := procReadFile.Call(
			uintptr(pipe),
			uintptr(unsafe.Pointer(&buf[0])),
			uintptr(len(buf)),
			uintptr(unsafe.Pointer(&read)),
			0,
		)
		if ok == 0 {
			done <- fmt.Errorf("ReadFile: %v", err)
			return
		}
		resp := string(buf[:read])
		if !strings.Contains(resp, "OK") {
			done <- fmt.Errorf("unexpected handshake: %q", resp)
			return
		}
		done <- nil
	}()
	select {
	case err := <-done:
		return err
	case <-time.After(time.Duration(timeoutSec) * time.Second):
		return fmt.Errorf("handshake timeout %ds", timeoutSec)
	}
}

func spawnEngine(gitRoot string, ipc IPCNames, pipeName, nonce string) error {
	engineDir := filepath.Join(gitRoot, filepath.FromSlash(ipc.EngineDirRel))
	engineExe := filepath.Join(engineDir, ipc.EngineExeName)
	if _, err := os.Stat(engineExe); err != nil {
		return fmt.Errorf("missing_engine")
	}
	cmd := exec.Command(engineExe)
	cmd.Dir = engineDir
	cmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow:    true,
		CreationFlags: 0x00000008 | 0x00000200, // DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP
	}
	env := os.Environ()
	env = append(env,
		ipc.EnvGitRoot+"="+gitRoot,
		ipc.EnvHandshakePipe+"="+pipeName,
		ipc.EnvHandshakeNonce+"="+nonce,
	)
	cmd.Env = env
	return cmd.Start()
}

func preflight(gitRoot string, ipc IPCNames) string {
	runtimePy := filepath.Join(gitRoot, filepath.FromSlash(ipc.RuntimePythonRel))
	if _, err := os.Stat(runtimePy); err != nil {
		return "missing_runtime"
	}
	launchPy := filepath.Join(gitRoot, filepath.FromSlash(ipc.LaunchPyRel))
	if _, err := os.Stat(launchPy); err != nil {
		return "missing_launch"
	}
	engineExe := filepath.Join(gitRoot, filepath.FromSlash(ipc.EngineDirRel), ipc.EngineExeName)
	if _, err := os.Stat(engineExe); err != nil {
		return "missing_engine"
	}
	if !hasWebView2() {
		return "webview2"
	}
	return ""
}

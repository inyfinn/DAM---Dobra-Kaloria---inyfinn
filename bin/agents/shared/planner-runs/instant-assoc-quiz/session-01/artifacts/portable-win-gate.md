# portable-win-gate (P0.4)

- date: 2026-08-05T15:28:08.7316340+02:00
- bundled_pythonw: bin/runtime/win/python/pythonw.exe present
- finder prefers bundled (no C:\Python*): PASS
- DAM.exe rebuilt: PASS
- boot-heal.html: present
- http_8765: 200
- http_8766: 200
- verdict: PASS

Note: End-user PC without system Python uses only bin/runtime/win. System Python gated by DAM_ALLOW_SYSTEM_PYTHON=1.

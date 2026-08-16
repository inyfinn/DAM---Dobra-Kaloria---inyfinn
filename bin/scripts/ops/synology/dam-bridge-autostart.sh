#!/bin/sh
# Autostart DAM bridge po restarcie NAS (Task Scheduler: boot-up)
/volume1/web/_nginx/start-dam-bridge.sh >> /volume1/web/_nginx/dam-bridge-boot.log 2>&1

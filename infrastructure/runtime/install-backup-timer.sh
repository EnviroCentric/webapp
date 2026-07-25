#!/usr/bin/env bash
set -euo pipefail

chmod 0750 /opt/enviro-centric/backup-postgres.sh
install -m 0644 enviro-backup.service /etc/systemd/system/enviro-backup.service
install -m 0644 enviro-backup.timer /etc/systemd/system/enviro-backup.timer
systemctl daemon-reload
systemctl enable --now enviro-backup.timer
systemctl start enviro-backup.service
systemctl status --no-pager enviro-backup.timer

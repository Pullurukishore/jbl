# Kardex JBL 24/7 Windows Service Guide

This project runs continuously 24/7 as native Windows services using NSSM.

## Quick Setup

Open **PowerShell as Administrator** and run:

```powershell
cd "c:\Users\kisho\OneDrive\Desktop\jbl\Kardex\Kardex"
.\install-services-nssm.ps1
```

This will:
1. Build frontend (`npm run build`).
2. Register and start `KardexJblBackend` (Port 5005).
3. Register and start `KardexJblFrontend` (Port 3000).
4. Configure auto-start on Windows boot (without requiring user login).
5. Configure 10 MB rotating logs and auto-restart on crash.

---

## Service Management

```powershell
# View status
Get-Service KardexJbl*

# Restart services
Restart-Service KardexJblBackend
Restart-Service KardexJblFrontend

# Stop services
Stop-Service KardexJblBackend
Stop-Service KardexJblFrontend

# Start services
Start-Service KardexJblBackend
Start-Service KardexJblFrontend

# Uninstall services
.\uninstall-services-nssm.ps1
```

Or open `services.msc` to view them in the Windows Services GUI.

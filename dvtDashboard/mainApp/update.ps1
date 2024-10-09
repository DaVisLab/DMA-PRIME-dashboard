# Update Dashboard

# pull new code from git main branch
cd C:\DMA-PRIME-dashboard\dvtDashboard
git checkout main
$proc = Start-Process -FilePath "C:\Program Files\Git\cmd\git.exe" -ArgumentList 'pull' -WorkingDirectory "C:\DMA-PRIME-dashboard" -PassThru
# wait up to 15 seconds for pull to execute
$proc | Wait-Process -Timeout 15 -ErrorAction SilentlyContinue -ErrorVariable TimedOut
if ($TimedOut) { $ proc | kill } # terminate if it hangs

# build new wheel and move it for safe keeping
python -m build --wheel
Move-Item -Path "C:\DMA-PRIME-dashboard\dvtDashboard\dist\*.whl" -Destination "C:\DMA-PRIME\wheels" -Force

# activate the python virtual environment and update the web application
cd C:\DMA-PRIME
.\.venv\Scripts\activate.ps1
cd C:\DMA-PRIME\wheels
$file = Get-ChildItem | Sort-Object LastWriteTime | select -last 1
pip install $file.Name --force-reinstall

# restart the server so the updated website is served
Restart-Computer -Force 
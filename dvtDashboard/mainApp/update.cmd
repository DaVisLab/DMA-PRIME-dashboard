@REM Update
cd C:\DMA-PRIME-dashboard\dvtDashboard
git checkout main
git pull
python -m build --wheel
cp C:\DMA-PRIME-dashboard\dvtDashboard\dist\*.whl C:\DMA-PRIME\wheels
cd C:\DMA-PRIME
.venv\Scripts\activate
cd C:\DMA-PRIME-dashboard\dvtDashboard\dist\
for /f %%i in ('dir /b/a-d/od/t:c') do set LAST=%%i
pip install %LAST%
shutdown /soft
@REM Update Dashboard

@REM pull new code from git
cd C:\DMA-PRIME-dashboard\dvtDashboard
git checkout main
git stash
git stash clear
git pull
@REM start "PullMain" /d "C:\DMA-PRIME-dashboard" git pull
@REM timeout 15
@REM taskkill /f /fi "WindowTitle eq PullMain"
@REM taskkill /f /fi "ImageName eq git.exe"

@REM build new wheel and move it for safe keeping
python -m build --wheel
move /Y C:\DMA-PRIME-dashboard\dvtDashboard\dist\*.whl C:\DMA-PRIME\wheels 

@REM activate the python virtual environment and update the web application
cd C:\DMA-PRIME
call .venv\Scripts\activate
cd C:\DMA-PRIME\wheels
for /f %%i in ('dir /b/a-d/od/t:c') do set LAST=%%i
pip install %LAST% --force-reinstall

@REM restart the server so the updated website is served
shutdown /r /soft
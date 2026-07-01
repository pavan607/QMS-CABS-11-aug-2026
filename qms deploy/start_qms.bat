@echo off

echo Checking Docker...

docker info >nul 2>&1

IF %ERRORLEVEL% NEQ 0 (

    echo Starting Docker Desktop...

    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"

    echo Waiting for Docker to start...

    :WAIT_DOCKER
    timeout /t 10 >nul

    docker info >nul 2>&1
    IF %ERRORLEVEL% NEQ 0 goto WAIT_DOCKER
)

echo Docker is ready ✅

docker inspect qms >nul 2>&1

IF ERRORLEVEL 1 (

    echo Creating QMS container...

    docker run -d ^
    --name qms ^
    --restart unless-stopped ^
    -p 3000:3000 ^
    -e NODE_ENV=production ^
    -e AUTH_TRUST_HOST=true ^
    -e DATABASE_URL=postgresql://postgres:root@host.docker.internal:5432/QMS ^
    -v "D:\Techfluent projects\qms 22-04-2026\deploy\uploads\public:/app/public/uploads" ^
    qms:latest

) ELSE (

    echo Starting existing QMS container...

    docker start qms
)

echo Done ✅
exit
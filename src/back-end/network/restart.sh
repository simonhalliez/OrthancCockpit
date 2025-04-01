docker stop network-manager
docker rm network-manager
docker build -t network .
docker run -d -p 3002:80 --name network-manager --env PUBLIC_IP_DB=192.168.1.9 --env PASSWORD_DB=motdepasse network 
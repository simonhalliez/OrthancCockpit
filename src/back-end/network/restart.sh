docker stop network-service
docker rm network-service
docker build -t network .
docker run -d -p 3002:80 --name network-service network
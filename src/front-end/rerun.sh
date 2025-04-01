docker stop front-end-service
docker rm front-end-service
docker build -t front-end .
docker run -d -p 3000:3000 --name front-end-service front-end
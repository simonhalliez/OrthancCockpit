#!/bin/bash

case "$1" in
    "build")
        docker pull neo4j:2025.07-bullseye
        docker pull jodogne/orthanc-plugins:1.12.6
        docker build -t orthanc_cockpit_back ./back-end/network/
        docker build -t orthanc_cockpit_front ./front-end/
    ;;
    "init")
        export PUBLIC_IP_MANAGER=${2}
        export PORT_MANAGER=${3}
        export PORT_FRONT=${4}
        export ADMIN_PASSWORD=${5}
        docker swarm init --advertise-addr $PUBLIC_IP_MANAGER
        docker network create --driver overlay --attachable dicom-net
        docker stack deploy -c orthancCockpit.yml orthancCockpit
    ;;
    "stop")
        docker service rm $(docker service ls -q)
        docker swarm leave --force
        docker volume rm orthancCockpit_network-db-data
    ;;
    *)
        echo "Invalid command"
    ;;
esac

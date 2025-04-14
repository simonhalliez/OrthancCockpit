#!/bin/bash

case "$1" in
    "build")
        docker pull neo4j:2025.02.0-bullseye
        docker build -t network-service ./back-end/network/
        docker build -t front-end ./front-end/
    ;;
    "init")
        docker swarm leave --force
        export PUBLIC_IP_MANAGER=${2}
        export ADMIN_PASSWORD=${3}
        docker swarm init --advertise-addr ${2}
        docker network create --driver overlay --attachable dicom-net
        echo -e "If you wish to use a worker; run the command above in your worker VM.\nPress any key when you are finished.\nIf not, just skip this step by pressing any key."
        # read -n 1 -s
        # docker pull neo4j:2025.02.0-bullseye
        docker build -t network-service ./back-end/network/
        # docker build -t front-end ./front-end/
        docker stack deploy -c orthancCockpit.yml orthancCockpit
    ;;
    "leave")
        docker swarm leave --force
        ;;
    "remove_server")
        ORTHANC_NAME=$2
        docker service rm "orthancServers_${ORTHANC_NAME}"
        ;;
    *)
        echo "Invalid command"
        ;;
esac

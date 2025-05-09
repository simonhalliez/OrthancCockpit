#!/bin/bash

case "$1" in
    "build")
        docker pull neo4j:2025.02.0-bullseye
        docker pull jodogne/orthanc-plugins:1.12.6
        docker build -t network-service ./back-end/network/
        # docker build -t front-end ./front-end/
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

        sleep 40

        curl -X POST http://${PUBLIC_IP_MANAGER}:3002/add_Orthanc_server \
            -H "Content-Type: application/json" \
            -d '{
                "orthancName": "cardiology_4",
                "aet": "CARDIOLOGY_4",
                "ip": "",
                "hostNameSwarm": "OrthancManager",
                "publishedPortDicom": "4244",
                "publishedPortWeb": "8084",
                "targetPortDicom": "4242",
                "targetPortWeb": "8042",
                "visX": 0,
                "visY": 0,
                "status": false
            }'
            curl -X POST http://${PUBLIC_IP_MANAGER}:3002/add_Orthanc_server \
            -H "Content-Type: application/json" \
            -d '{
                "orthancName": "cardiology_3",
                "aet": "CARDIOLOGY_3",
                "ip": "",
                "hostNameSwarm": "OrthancManager",
                "publishedPortDicom": "4243",
                "publishedPortWeb": "8083",
                "targetPortDicom": "4242",
                "targetPortWeb": "8042",
                "visX": 0,
                "visY": 0,
                "status": false
            }'

    ;;
    "leave")
        docker swarm leave --force
        docker system prune --volumes --filter "label!=jodogne/orthanc-plugins:1.12.6" --filter "label!=neo4j:2025.02.0-bullseye"
        ;;
    "remove_server")
        ORTHANC_NAME=$2
        docker service rm "orthancServers_${ORTHANC_NAME}"
        ;;
    *)
        echo "Invalid command"
        ;;
esac

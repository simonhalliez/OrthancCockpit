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
        export PORT_MANAGER=${3}
        export ADMIN_PASSWORD=${4}
        docker swarm init --advertise-addr $PUBLIC_IP_MANAGER
        docker network create --driver overlay --attachable dicom-net
        # docker pull neo4j:2025.02.0-bullseye
        docker build -t network-service ./back-end/network/
        # docker build -t front-end ./front-end/
        docker volume rm orthancCockpit_network-db-data
        docker stack deploy -c orthancCockpit.yml orthancCockpit


    ;;
    "add_server")
        export PUBLIC_IP_MANAGER=${2}
        curl -X POST http://${PUBLIC_IP_MANAGER}:3002/add_Orthanc_server \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJleHAiOjE3NTExMjI4MTIsImlhdCI6MTc0OTkxMzIxMiwic3ViIjoiYWRtaW4ifQ.D87i-ZAPezQSIiphC8kN_YF3ADurX65-z3SMKDMC590" \
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
                "status": "pending",
                "uuid": "",
                "tags": []
            }'
        curl -X POST http://${PUBLIC_IP_MANAGER}:3002/add_Orthanc_server \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJleHAiOjE3NTExMjI4MTIsImlhdCI6MTc0OTkxMzIxMiwic3ViIjoiYWRtaW4ifQ.D87i-ZAPezQSIiphC8kN_YF3ADurX65-z3SMKDMC590" \
            -d '{"orthancName": "cardiology_4",
                "aet": "CARDIOLOGY_4",
                "ip": "",
                "hostNameSwarm": "OrthancManager",
                "publishedPortDicom": "4244",
                "publishedPortWeb": "8084",
                "targetPortDicom": "4242",
                "targetPortWeb": "8042",
                "visX": 0,
                "visY": 0,
                "status": "pending",
                "uuid": "",
                "tags": []
            }'
        curl -X POST http://${PUBLIC_IP_MANAGER}:3002/add_modality \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJleHAiOjE3NTExMjI4MTIsImlhdCI6MTc0OTkxMzIxMiwic3ViIjoiYWRtaW4ifQ.D87i-ZAPezQSIiphC8kN_YF3ADurX65-z3SMKDMC590" \
            -d '{
                "aet": "CT_CARDIO_104",
                "ip": "192.168.129.93",
                "publishedPortDicom": "4242",
                "description": "Room: a.105\nModel: NAEOTOM Alpha class\nCT-scan of the cardiology service. \nPseudo: admin\nPassword: serf34$QDfse\nLast review: 23/05/2025",
                "status": "pending",
                "visX": 0,
                "visY": 0,
                "uuid": "",
                "tags": []
            }'
        curl -X GET http://${PUBLIC_IP_MANAGER}:3002/update_status -H "Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJleHAiOjE3NTExMjI4MTIsImlhdCI6MTc0OTkxMzIxMiwic3ViIjoiYWRtaW4ifQ.D87i-ZAPezQSIiphC8kN_YF3ADurX65-z3SMKDMC590" 
        # curl -X POST http://${PUBLIC_IP_MANAGER}:3002/add_edge \
        #     -H "Content-Type: application/json" \
        #     -d '{
        #         "from": "CT_CARDIO_104",
        #         "to": "CARDIOLOGY_4",
        #         "status": false,
        #         "allowEcho": true,
        #         "allowFind": false,
        #         "allowGet": false,
        #         "allowMove": false,
        #         "allowStore": false,
        #         "id": "",
        #         "uuidFrom": "",
        #         "uuidTo": ""
        #     }'
        curl -X POST http://${PUBLIC_IP_MANAGER}:3002/add_edge \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJleHAiOjE3NTExMjI4MTIsImlhdCI6MTc0OTkxMzIxMiwic3ViIjoiYWRtaW4ifQ.D87i-ZAPezQSIiphC8kN_YF3ADurX65-z3SMKDMC590" \
            -d '{
                "from": "CT_CARDIO_104",
                "to": "CARDIOLOGY_3",
                "status": false,
                "allowEcho": true,
                "allowFind": false,
                "allowGet": false,
                "allowMove": false,
                "allowStore": false,
                "id": "",
                "uuidFrom": "",
                "uuidTo": ""
            }'
        curl -X POST http://${PUBLIC_IP_MANAGER}:3002/add_edge \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJleHAiOjE3NTExMjI4MTIsImlhdCI6MTc0OTkxMzIxMiwic3ViIjoiYWRtaW4ifQ.D87i-ZAPezQSIiphC8kN_YF3ADurX65-z3SMKDMC590" \
            -d '{
                "from": "CARDIOLOGY_4",
                "to": "CT_CARDIO_104",
                "status": false,
                "allowEcho": true,
                "allowFind": false,
                "allowGet": false,
                "allowMove": false,
                "allowStore": false,
                "id": "",
                "uuidFrom": "",
                "uuidTo": ""
            }'
        # curl -X POST http://${PUBLIC_IP_MANAGER}:3002/add_edge \
        #     -H "Content-Type: application/json" \
        #     -d '{
        #         "from": "CARDIOLOGY_3",
        #         "to": "CARDIOLOGY_4",
        #         "status": false,
        #         "allowEcho": true,
        #         "allowFind": false,
        #         "allowGet": false,
        #         "allowMove": false,
        #         "allowStore": false,
        #         "id": "",
        #         "uuidFrom": "",
        #         "uuidTo": ""
        #     }'
        curl -X POST http://${PUBLIC_IP_MANAGER}:3002/add_edge \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJleHAiOjE3NTExMjI4MTIsImlhdCI6MTc0OTkxMzIxMiwic3ViIjoiYWRtaW4ifQ.D87i-ZAPezQSIiphC8kN_YF3ADurX65-z3SMKDMC590" \
        -d '{
            "from": "CARDIOLOGY_4",
            "to": "CARDIOLOGY_3",
            "status": false,
            "allowEcho": true,
            "allowFind": false,
            "allowGet": false,
            "allowMove": false,
            "allowStore": false,
            "id": "",
            "uuidFrom": "",
            "uuidTo": ""
        }'

        curl -X POST http://${PUBLIC_IP_MANAGER}:3002/add_remote_server \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJleHAiOjE3NTExMjI4MTIsImlhdCI6MTc0OTkxMzIxMiwic3ViIjoiYWRtaW4ifQ.D87i-ZAPezQSIiphC8kN_YF3ADurX65-z3SMKDMC590" \
        -d '{
            "username": "admin",
            "password": "password",
            "state": "pending",
            "ip": "192.168.129.93",
            "publishedPortWeb": "8042",
            "publishedPortDicom": "4242"
        }'
        # curl -X POST http://${PUBLIC_IP_MANAGER}:3002/add_edge \
        #     -H "Content-Type: application/json" \
        #     -d '{
        #         "from": "CT_CARDIO_105",
        #         "to": "CARDIOLOGY_4",
        #         "status": false,
        #         "allowEcho": true,
        #         "allowFind": false,
        #         "allowGet": false,
        #         "allowMove": false,
        #         "allowStore": false,
        #         "id": "",
        #         "uuidFrom": "",
        #         "uuidTo": ""
        #     }'

        
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

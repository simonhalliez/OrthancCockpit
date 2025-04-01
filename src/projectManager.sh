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
    "new_server")
        # Put Argument in variable
        ORTHANC_NAME=$2
        ORTHANC_AET=$3
        HOST_NAME=$4
        PORTS_WEB=$5
        PORTS_DICOM=$6

        IFS=':' read -r PORT_WEB_IN PORT_WEB_OUT <<< "$PORTS_WEB"
        IFS=':' read -r PORT_DICOM_IN PORT_DICOM_OUT <<< "$PORTS_DICOM"

        # Copy the template
        cp templateOrthanc.yml currentOrthanc.yml

        # Adapt the template YAML file to the specific configuration
        sed -i "s/service_name/$ORTHANC_NAME/" currentOrthanc.yml
        sed -i "s/node.hostname == hostname/node.hostname == $HOST_NAME/" currentOrthanc.yml
        sed -i "s/portWeb:portWeb/$PORTS_WEB/" currentOrthanc.yml
        sed -i "s/portDICOM:portDICOM/$PORTS_DICOM/" currentOrthanc.yml

        # Adapt the JSON of configuration
        jq --arg name "$ORTHANC_NAME" --arg aet "$ORTHANC_AET" --argjson web $PORT_WEB_IN --argjson dicom $PORT_DICOM_IN '.Name = $name | .DicomAet = $aet | .DicomPort = $dicom | .HttpPort = $web' config.json > configTmp.json


        # Deploy the docker image
        docker stack deploy -c currentOrthanc.yml orthancServers

        # Remove temporary files
        rm currentOrthanc.yml
        rm configTmp.json
        ;;
    "remove_server")
        ORTHANC_NAME=$2
        docker service rm "orthancServers_${ORTHANC_NAME}"
        ;;
    *)
        echo "Invalid command"
        ;;
esac

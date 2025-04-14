#!/bin/bash

set -e

# Redirect errors to stderr and handle them globally
trap 'exit 1' ERR

case "$1" in
    
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
        cp templates/templateOrthanc.yml templates/currentOrthanc.yml

        # Adapt the template YAML file to the specific configuration
        sed -i "s/service_name/$ORTHANC_NAME/" templates/currentOrthanc.yml
        sed -i "s/node.hostname == hostname/node.hostname == $HOST_NAME/" templates/currentOrthanc.yml
        sed -i "s/portWeb:portWeb/$PORTS_WEB/" templates/currentOrthanc.yml
        sed -i "s/portDICOM:portDICOM/$PORTS_DICOM/" templates/currentOrthanc.yml
        sed -i "s/configTmp.json/$ORTHANC_AET.json/" templates/currentOrthanc.yml

        # Adapt the JSON of configuration
        jq --arg name "$ORTHANC_NAME" --arg aet "$ORTHANC_AET" --argjson dicom $PORT_DICOM_OUT --arg adminPassword "$ADMIN_PASSWORD" '.Name = $name | .DicomAet = $aet | .DicomPort = $dicom | .RegisteredUsers.admin = $adminPassword' templates/config.json > templates/$ORTHANC_AET.json

        # Deploy the docker image
        docker stack deploy -d -c templates/currentOrthanc.yml orthancServers

        # Remove temporary files
        rm templates/currentOrthanc.yml
        ;;
    "remove_server")
        ORTHANC_NAME=$2
        docker service rm "orthancServers_${ORTHANC_NAME}"
        ;;
    *)
        echo "Invalid command" >&2
        exit 2
        ;;
esac

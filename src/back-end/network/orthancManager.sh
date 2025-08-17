#!/bin/bash

set -e

case "$1" in
    
    "new_server")
        
        # Put Argument in variable
        HOST_NAME=$2
        PORT_WEB_IN=$3
        PORT_WEB_OUT=$4
        PORT_DICOM_IN=$5
        PORT_DICOM_OUT=$6
        UUID=$7
        CONFIGURATION_NUMBER=${8}

        SECRET_NAME="sec_${UUID}_V${CONFIGURATION_NUMBER}"

        # Copy the template
        cp templates/templateOrthanc.yml templates/currentOrthanc.yml

        # Adapt the template YAML file to the specific configuration
        sed -i "s/service_name/server_$UUID/" templates/currentOrthanc.yml
        sed -i "s/node.hostname == hostname/node.hostname == $HOST_NAME/" templates/currentOrthanc.yml
        sed -i "s/portWeb:portWeb/$PORT_WEB_IN:$PORT_WEB_OUT/" templates/currentOrthanc.yml
        sed -i "s/portDICOM:portDICOM/$PORT_DICOM_IN:$PORT_DICOM_OUT/" templates/currentOrthanc.yml
        sed -i "s/secret_name/$SECRET_NAME/" templates/currentOrthanc.yml
        sed -i "s/volume_name/volume_$UUID/" templates/currentOrthanc.yml
        
        # Deploy the docker image
        docker stack deploy -d -q -c templates/currentOrthanc.yml orthancServers > /dev/null

        # Remove temporary files
        rm templates/currentOrthanc.yml

        # Inspect the deployed service to recover docker service information.
        docker service inspect "orthancServers_server_$UUID" --format '{
            "serviceId": "{{.ID}}",
            "volumeName": "{{(index .Spec.TaskTemplate.ContainerSpec.Mounts 0).Source}}",
            "secretName": "{{(index .Spec.TaskTemplate.ContainerSpec.Secrets 0).SecretName}}"
            }'
        ;;
    *)
        echo "Invalid command" >&2
        exit 2
        ;;
esac

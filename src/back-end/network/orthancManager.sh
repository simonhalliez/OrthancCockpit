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

        # Adapt the JSON of configuration
        # jq --arg name "$ORTHANC_NAME" --arg aet "$ORTHANC_AET" --argjson dicom $PORT_DICOM_OUT --argjson portWeb $PORT_WEB_OUT --arg adminPassword "$ADMIN_PASSWORD" '.Name = $name | .DicomAet = $aet | .DicomPort = $dicom | .HttpPort = $portWeb| .RegisteredUsers.admin = $adminPassword' templates/config.json > templates/$SECRET_NAME.json
        
        # Deploy the docker image
        docker stack deploy -d -q -c templates/currentOrthanc.yml orthancServers > /dev/null

        # Remove temporary files
        rm templates/currentOrthanc.yml

        docker service inspect "orthancServers_server_$UUID" --format '{
            "serviceId": "{{.ID}}",
            "volumeName": "{{(index .Spec.TaskTemplate.ContainerSpec.Mounts 0).Source}}",
            "secretName": "{{(index .Spec.TaskTemplate.ContainerSpec.Secrets 0).SecretName}}"
            }'
        ;;
    # "create_secret")
    #     # Put Argument in variable
    #     ORTHANC_NAME=$2
    #     ORTHANC_AET=$3
    #     PORT_WEB_OUT=$4
    #     PORT_DICOM_OUT=$5
    #     CONFIGURATION_NUMBER=$6
    #     SERVER_NUMBER=$7
    #     SECRET_NAME="orthancServers_secret_${SERVER_NUMBER}_V$CONFIGURATION_NUMBER.json"
    #     # Create the json of configuration
    #     jq --arg name "$ORTHANC_NAME" --arg aet "$ORTHANC_AET" --argjson dicom $PORT_DICOM_OUT --argjson portWeb $PORT_WEB_OUT --arg adminPassword "$ADMIN_PASSWORD" '.Name = $name | .DicomAet = $aet | .DicomPort = $dicom | .HttpPort = $portWeb| .RegisteredUsers.admin = $adminPassword' templates/config.json > templates/${ORTHANC_AET}_V$CONFIGURATION_NUMBER.json
    #     # Create the secret
    #     docker secret create $SECRET_NAME templates/${ORTHANC_AET}_V$CONFIGURATION_NUMBER.json > /dev/null
    #     echo $SECRET_NAME
    #     ;;
    *)
        echo "Invalid command" >&2
        exit 2
        ;;
esac

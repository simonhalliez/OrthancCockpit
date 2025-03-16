import { writable } from "svelte/store";

export const network = writable(
    {
    nodes: [
        {
            ORTHANC_NAME: "Cardiology_Server_1",
            AET: "CARDIOLOGY_SERVER_1",
            HOST_NAME_SWARM: "OrthancPACS",
            PORTS_WEB: "8042",
            PORTS_DICOM: "4242",
            STATUS: true,
            TYPE: "Orthanc_server"
        },
        {
            ORTHANC_NAME: "Cardiology_Server_2",
            AET: "CARDIOLOGY_SERVER_2",
            HOST_NAME_SWARM: "OrthancPACS",
            PORTS_WEB: "8043",
            PORTS_DICOM: "4243",
            STATUS: false,
            TYPE: "Orthanc_server"
        },
        {
            AET: "ULTRASOUND_12345",
            IP: "172.17.31",
            PORTS_DICOM: "4243",
            STATUS: true,
            TYPE: "Modality"
        }
    ],
    edges: [
        {
            FROM: "CARDIOLOGY_SERVER_2",
            TO: "CARDIOLOGY_SERVER_1",
            STATUS: true
        },
        {
            FROM: "ULTRASOUND_12345",
            TO: "CARDIOLOGY_SERVER_2",
            STATUS: false
        },
        {
            TO: "ULTRASOUND_12345",
            FROM: "CARDIOLOGY_SERVER_2",
            STATUS: false
        }
    ]
}
);
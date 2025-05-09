type BaseNode = {
    aet: string;
    ip: string;
    publishedPortDicom: string;
    status: boolean;
    visX: number;
    visY: number;
    uuid: string;
};

interface OrthancServer extends BaseNode {
    orthancName: string;
    hostNameSwarm: string;
    publishedPortWeb: string;
    targetPortWeb: string;
    targetPortDicom: string;
}

interface DICOMModality extends BaseNode {
    description: string;
    outputPortDicom: string;
}

type DicomNode = OrthancServer | DICOMModality;

type Edge = {
    from: string;
    uuidFrom: string;
    uuidTo: string;
    to: string;
    status: boolean;
    id: string;
    allowEcho: boolean;
    allowFind: boolean;
    allowGet: boolean;
    allowMove: boolean;
    allowStore: boolean;
};

type Network = {
    nodes: {orthancServers: OrthancServer[]; dicomModalities: DICOMModality[]};
    edges: Edge[];
};
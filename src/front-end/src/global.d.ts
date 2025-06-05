type BaseNode = {
    aet: string;
    ip: string;
    publishedPortDicom: string;
    status: string;
    visX: number;
    visY: number;
    uuid: string;
    tags: Tag[];
};

interface OrthancServer extends BaseNode {
    orthancName: string;
    hostNameSwarm: string;
    publishedPortWeb: string;
    targetPortWeb: string;
    targetPortDicom: string;
    users: OrthancUser[];
}

interface DICOMModality extends BaseNode {
    description: string;
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
    nodes: DicomNode[];//{orthancServers: OrthancServer[]; dicomModalities: DICOMModality[]};
    edges: Edge[];
};

type Tag = {
    name: string;
    color: string;
}

type OrthancUser = {
    username: string;
    state: string;
    password: string;
}
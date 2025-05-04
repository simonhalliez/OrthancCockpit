type BaseNode = {
    aet: string;
    publishedPortDicom: string;
    status: boolean;
    visX: number;
    visY: number;
};

interface OrthancServer extends BaseNode {
    orthancName: string;
    hostNameSwarm: string;
    publishedPortWeb: string;
    targetPortWeb: string;
    targetPortDicom: string;
}

interface DICOMModality extends BaseNode {
    IP: string;
}

type Node = OrthancServer | DICOMModality | BaseNode;

type Edge = {
    from: string;
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
    nodes: Node[];
    edges: Edge[];
};
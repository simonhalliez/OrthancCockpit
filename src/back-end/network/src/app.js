// Adapted from example code provided in the UCLouvain LINFO2145 course project
const express = require('express');
const log = require('debug')('network-d');
const { Neo4jDriver } = require('./utils/neo4j-driver');
const { SwarmService } = require('./utils/swarm-service');
const { OrthancService } = require('./utils/orthanc-service');
const { DicomService } = require('./utils/dicom-service');
const { ModalityService } = require('./utils/modality-service');
const { UserService } = require('./utils/user-service');
const { encodeToken, decodeToken } = require('./utils/en-de-coders');

const app = express.Router();
const DB_IP = process.env.PUBLIC_IP_DB || 'localhost';
const PASSWORD = process.env.ADMIN_PASSWORD || 'password';

const neo4jDriver = new Neo4jDriver(DB_IP, PASSWORD);
neo4jDriver.connect();
const swarmService = new SwarmService(neo4jDriver);
const modalityService = new ModalityService(neo4jDriver);
const dicomService = new DicomService(neo4jDriver);
const orthancService = new OrthancService(neo4jDriver, dicomService);
const userService = new UserService(neo4jDriver, orthancService);
swarmService.addInitialSwarmNodes();
swarmService.updateSwarmNodes();

// --- Details of each route is available in the readme.md ---

// Identification routes
app.use((req, res, next) => {
  // Log the request method and path
  if (req.path === '/login') {
    return next();
  }
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'Unauthorized', message: 'No authorization header provided' });
  }

  if (authHeader.startsWith('Bearer ')) {
    // Handle Bearer token
    const token = authHeader.split(' ')[1];
    try {
      // Replace decodeToken with your JWT verification function
      decodeToken(token); 
      return next();
    } catch (err) {
      return res.status(401).json({ error: 'Invalid token', message: 'Invalid Token: ' + err.message });
    }
  }
  return res.status(401).json({ error: 'Unauthorized', message: 'Invalid authorization header format' });
});

app.post('/login', (req, res) => {
  // Get the Authorization header
  const { username, password } = req.body;

  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid admin password' });
  } else {
    return res.status(200).json({
      status: 'ok',
      message: 'Login successful',
      token: encodeToken(username)
    });
  }
});

app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Welcome to the OrthancCockpit API',
    version: '1.0.0'
  });
});

// Nodes routes
// Orthanc server routes
app.post('/nodes/orthanc-servers', (req, res) => {
  return orthancService.addOrthancServer(req.body).then((server) => {
    return res.status(200).json({
      status: 'ok',
      uuid: server.uuid,
    });
  }).catch((err) => {
    return res.status(500).json({
      status: 'error',
      message: 'Failed to add Orthanc server: ' + err.message,
      error: err.message
    });
  });
});

app.post('/nodes/orthanc-servers/remote', (req, res) => {
  return orthancService.addRemoteServer(req.body).then((uuid) => {
    return res.status(200).json({
      status: 'ok',
      uuid: uuid
    });
  }).catch((err) => {
    log("Error when adding remote server: ", err);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to add remote server: ' + err.message,
      error: err.message
    });
  });
})

app.get('/nodes/orthanc-servers', (req, res) => {
  return neo4jDriver.getOrthancServers().then((orthancServers) => {
    return res.status(200).json({
      status: 'ok',
      data: orthancServers
    });
  }).catch((err) => {
    log("Error when retrieving orthanc servers: ", err);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve orthanc servers: ' + err.message,
      error: err.message
    });
  });
});

app.get('/nodes/orthanc-servers/:uuid', (req, res) => {
  const uuid = req.params.uuid;
  return neo4jDriver.getOrthancServer(uuid)
  .then((orthancServer) => {
    return res.status(200).json({
      status: 'ok',
      data: orthancServer
    });
  })
  .catch((err) => {
    log("Error when retrieving orthanc server: ", err);
    return res.status(404).json({
      status: 'error',
      message: 'Failed to retrieve orthanc server: ' + err.message,
      error: err.message
    });
  });
});

app.put('/nodes/orthanc-servers/:uuid', (req, res) => {
  req.body.uuid = req.params.uuid;
  return orthancService.editServer(req.body).then((uuid) => {
    return res.status(200).json({
      status: 'ok',
      uuid: uuid
    });
  }).catch((err) => {
    log("Error when editing the server: ", err);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to edit the server ' + err.message,
    });
  });
})

app.put('/nodes/orthanc-servers/remote/:uuid', (req, res) => {
  req.body.uuid = req.params.uuid;
  return orthancService.editServer(req.body).then((uuid) => {
    return res.status(200).json({
      status: 'ok',
      uuid: uuid
    });
  }).catch((err) => {
    log("Error when editing the remote server: ", err);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to edit the remote server ' + err.message,
    });
  });
})

app.delete('/nodes/:uuid', (req, res) => {
  return orthancService.deleteModality(req.params.uuid).then(() => {
    return res.status(200).json({
      status: 'ok',
      uuid: req.params.uuid
    });
  }).catch((err) => {
    log("Error when deleting a server: ", err);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to delete a server ' + err.message,
    });
  });
})

app.put('/nodes/:uuid/position', (req, res) => {
  return neo4jDriver.updateNodePosition({uuid: req.params.uuid, ...req.body}).then((result) => {
    return res.status(200).json({
      status: 'ok',
      uuid: req.params.uuid,
    });
  })
  .catch((err) => {
    log("Error: ", err);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to update node position: ' + err.message,
      error: err.message
    });
  });
});

// Modality routes
app.get('/nodes/modalities/:uuid',async (req, res) => {
  const uuid = req.params.uuid;
  return neo4jDriver.getModality(uuid).then((modality) => {
    return res.status(200).json({
      status: 'ok',
      data: modality
    });
  }).catch((err) => {
    log("Error when retrieving modality: ", err);
    return res.status(404).json({
      status: 'error',
      message: 'Failed to retrieve modality: ' + err.message,
      error: err.message
    });
  });
})

app.post('/nodes/modalities',async (req, res) => {
  await orthancService.updateServerStatus();
  return modalityService.addModality(req.body).then((uuid) => {
    return res.status(200).json({
      status: 'ok',
      uuid: uuid
    });
  }).catch((err) => {
    log("Error when adding modality: ", err);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to add modality: ' + err.message,
      error: err.message
    });
  });
})

app.put('/nodes/modalities/:uuid', (req, res) => {
  req.body.uuid = req.params.uuid;
  return modalityService.editModality(req.body).then(() => {
    return res.status(200).json({
      status: 'ok',
      uuid: req.params.uuid
    });
  }).catch((err) => {
    log("Error when editing the modality: ", err);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to edit the modality: ' + err.message,
      error: err.message
    });
  });
})

// Edge routes
app.get('/edges/:id', async (req, res) => {
  const id = req.params.id;
  return neo4jDriver.getEdge(id).then((edge) => {
    return res.status(200).json({
      status: 'ok',
      data: edge
    });
  }).catch((err) => {
    log("Error when retrieving edge: ", err);
    return res.status(404).json({
      status: 'error',
      message: 'Failed to retrieve edge: ' + err.message,
      error: err.message
    });
  });
});

app.get('/edges', async (req, res) => {
  return neo4jDriver.getEdges().then((edges) => {
    return res.status(200).json({
      status: 'ok',
      data: edges
    });
  }).catch((err) => {
    log("Error when retrieving edges: ", err);
    return res.status(404).json({
      status: 'error',
      message: 'Failed to retrieve edges: ' + err.message,
      error: err.message
    });
  });
});

app.post('/edges', async (req, res) => {
  await orthancService.updateServerStatus();
  return dicomService.addEdge(req.body).then((linkId) => {
    return res.status(200).json({
      status: 'ok',
      id: linkId
    });
  }).catch((err) => {
    log("Error when adding edge: ", err);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to add edge: ' + err.message,
      error: err.message
    });
  });
});


app.delete('/edges/:id', (req, res) => {
  return dicomService.deleteLink(req.params.id).then(() => {
    return res.status(200).json({
      status: 'ok',
      id: req.params.id
    });
  }).catch((err) => {
    log("Error when deleting an edge: ", err);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to delete the edge: ' + err.message,
      error: err.message
    });
  });
});

// Tags Routes

app.post('/nodes/tags', (req, res) => {
  return orthancService.addTag(req.body).then(() => {
    return res.status(200).json({
      status: 'ok'
    });
  }).catch((err) => {
    log("Error when adding the tag: ", err);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to add the tag',
      error: err.message
    });
  });
})

app.post('/nodes/untag', (req, res) => {
  return orthancService.untagNode(req.body).then(() => {
    return res.status(200).json({
      status: 'ok'
    });
  }).catch((err) => {
    log("Error when untagging the node: ", err);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to untagging the node: ',
      error: err.message
    });
  });
})

app.get('/nodes/tags', (req, res) => {
  return neo4jDriver.getTags().then((result) => {
    return res.status(200).json({
      status: 'ok',
      data: result
    });
  }).catch((err) => {
    log("Error when retrieving tags: ", err);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve tags: ',
      error: err.message
    });
  });
})

app.put('/nodes/tags/:tagName', (req, res) => {
  return neo4jDriver.editTag({ tagName: req.params.tagName, ...req.body }).then(() => {
    return res.status(200).json({
      status: 'ok'
    });
  }).catch((err) => {
    log("Error when editing tag: ", err);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to edit the tag: ',
      error: err.message
    });
  });
})

app.delete('/nodes/tags/:tagName', (req, res) => {
  return neo4jDriver.deleteTag(req.params.tagName).then(() => {
    return res.status(200).json({
      status: 'ok',
      tagName: req.params.tagName
    });
  }).catch((err) => {
    log("Error when deleting tag: ", err);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to delete the tag: ',
      error: err.message
    });
  });
});

// User routes
app.post('/nodes/orthanc-servers/:uuid/users', (req, res) => {
  return userService.addUser({ ...req.body, uuid: req.params.uuid }).then((userId) => {
    return res.status(200).json({
      status: 'ok',
      userId: userId
    });
  }).catch((err) => {
    log("Error when adding user: ", err);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to add user' + err.message,
      error: err.message
    });
  });
})

app.delete('/nodes/orthanc-servers/:uuid/users/:userId', (req, res) => {
  return userService.removeUser(req.params).then(() => {
    return res.status(200).json({
      status: 'ok'
    });
  }).catch((err) => {
    log("Error when deleting user: ", err);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to delete user' + err.message,
      error: err.message
    });
  });
})

app.get('/network', (req, res) => {
  neo4jDriver.retrieveNetwork()
  .then((result) => {
    log("Get network result");
    return res.status(200).json({
      status: 'ok',
      data: result
    });
  })
  .catch((err) => {
    log("Error: ", err);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve network: ' + err.message,
      error: err.message
    });
  });
});


app.get('/network/update_status', async (req, res) => {
    await userService.updateUserState();
    await orthancService.updateServerStatus();
    await dicomService.testDicomConnections();
    await modalityService.updateModalitiesStatus();
    return res.status(200).json({
      status: 'ok'
    });
});

module.exports = app;

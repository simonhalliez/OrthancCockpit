const express = require('express');
const log = require('debug')('product-d');
const { Neo4jDriver } = require('./utils/neo4j-driver');
const { SwarmService } = require('./utils/swarm-service');
const { OrthancService } = require('./utils/orthanc-service');
const { DicomService } = require('./utils/dicom-service');
const { ModalityService } = require('./utils/modality-service');
const { UserService } = require('./utils/user-service');

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


app.post('/add_Orthanc_server', (req, res) => {
  return orthancService.addOrthancServer(req.body).then(() => {
    return res.status(200).json({
      status: 'ok'
    });
  }).catch((err) => {
    return res.status(500).json({
      status: 'error',
      message: 'Failed to add Orthanc server',
      error: err.message
    });
  });
});

app.post('/add_modality',async (req, res) => {
  await orthancService.updateServerStatus();
  return modalityService.addModality(req.body).then(() => {
    return res.status(200).json({
      status: 'ok'
    });
  }).catch((err) => {
    log("Error when adding modality: ", err);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to add modality',
      error: err.message
    });
  });
})

app.post('/add_edge', async (req, res) => {
  await orthancService.updateServerStatus();
  return dicomService.addEdge(req.body).then(() => {
    return res.status(200).json({
      status: 'ok'
    });
  }).catch((err) => {
    log("Error when adding edge: ", err);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to add edge',
      error: err.message
    });
  });
});

app.get('/network', (req, res) => {
  const network = neo4jDriver.retrieveNetwork()
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
      message: 'Failed to retrieve network',
      error: err.message
    });
  });
});

app.post('/update_node_position', (req, res) => {
  return neo4jDriver.updateNodePosition(req.body).then((result) => {
    return res.status(200).json({
      status: 'ok'
    });
  })
  .catch((err) => {
    log("Error: ", err);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to update node position',
      error: err.message
    });
  });
});

app.get('/update_status', async (req, res) => {
  try {
    await orthancService.updateServerStatus();
    await dicomService.testDicomConnections()
    await modalityService.updateModalitiesStatus();
    await userService.updateUserState();
    return res.status(200).json({
      status: 'ok'
    });
  }
  catch (err) {
    log("Error when updating status: ", err);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to update status',
      error: err.message
    });
  }
});

app.post('/delete_node', (req, res) => {
  return orthancService.deleteServer(req.body).then(() => {
    return res.status(200).json({
      status: 'ok'
    });
  }).catch((err) => {
    log("Error when deleting a server: ", err);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to delete a server',
      error: err.message
    });
  });
})

app.post('/delete_edge', (req, res) => {
  return dicomService.deleteLink(req.body).then(() => {
    return res.status(200).json({
      status: 'ok'
    });
  }).catch((err) => {
    log("Error when deleting an edge: ", err);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to delete the edge',
      error: err.message
    });
  });
})

app.post('/edit_server', (req, res) => {
  return orthancService.editServer(req.body).then(() => {
    return res.status(200).json({
      status: 'ok'
    });
  }).catch((err) => {
    log("Error when editing the server: ", err);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to edit the server',
      error: err.message
    });
  });
})

app.post('/edit_modality', (req, res) => {
  return modalityService.editModality(req.body).then(() => {
    return res.status(200).json({
      status: 'ok'
    });
  }).catch((err) => {
    log("Error when editing the modality: ", err);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to edit the modality',
      error: err.message
    });
  });
})

app.post('/tag_node', (req, res) => {
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

app.post('/untag_node', (req, res) => {
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

app.get('/get_tags', (req, res) => {
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

app.post('/edit_tag', (req, res) => {
  return neo4jDriver.editTag(req.body).then(() => {
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

app.post('/delete_user', (req, res) => {
  return userService.removeUser(req.body).then(() => {
    return res.status(200).json({
      status: 'ok'
    });
  }).catch((err) => {
    log("Error when deleting user: ", err);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to delete user',
      error: err.message
    });
  });
})

app.post('/add_user', (req, res) => {
  return userService.addUser(req.body).then(() => {
    return res.status(200).json({
      status: 'ok'
    });
  }).catch((err) => {
    log("Error when adding user: ", err);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to add user',
      error: err.message
    });
  });
})

module.exports = app;

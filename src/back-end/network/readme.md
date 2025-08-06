<h1>This is the REST API of network service</h1>
# OrthancCockpit REST API

# Authentication

### Login
- **POST** `/login`
  - **Body:** 
    - username: The name of the user (string).
    - password: The admin password choose at the creation of the OrthancCockpit (string).
    ```json
      { 
        "username": "string",
        "password": "string"
      }
    ```
  - **Response:** `{ status: "ok", message: "Login successful", token: string }`
    - token: The token use like a password when a user do a request to the OrthancCockpit (string).
  - **Error:** `{ error: "Unauthorized" }`

---
# Network
### Get Network
- **GET** `/network`
  - **Response:**
    ```json
    {
      "status": "ok",
      "data": { /* Network object */ }
    }
    ```
    - `data`: The full network structure, including nodes, edges, and their relationships.
  - **Error:**
    ```json
    {
      "status": "error",
      "message": "Failed to retrieve network: ...",
      "error": "..."
    }
### Update Network Status
- **GET** `/network/update_status`
  - **Description:**  
    Updates the status of users, Orthanc servers, DICOM connections, and modalities in the network.
  - **Response:**
    ```json
    {
      "status": "ok"
    }
    ```
  - **Error:**
    ```json
    {
      "status": "error",
      "message": "Failed to update network status",
      "error": "..."
    }
    ```
---
# Nodes

### Delete A Node (A DICOM MODALITY)
- **DELETE** `/nodes/:uuid`
  - **Body:** `{ id: string }`
  - **Response:** `{ status: "ok" }`

### Update Node Position
- **PUT** `/nodes/:uuid/position`
  - **Body:** Position data
    - visX: The X coordinate of the node (integer).
    - visY: The Y coordinate of the node (integer).
    ```json
    {
      "visX": 100,
      "visY": 200
    }
    ```
  - **Response:**
    ```json
    {
      "status": "ok",
      "uuid": "string"
    }
    ```
    - `uuid`: The UUID of the updated node.
  - **Error:**
    ```json
    {
      "status": "error",
      "message": "Failed to update node position: ...",
      "error": "..."
    }
    ```

## Orthanc Servers


### Get Orthanc Server by UUID
- **GET** `/nodes/orthanc-servers/:uuid`
  - **Response:**
    ```json
    {
      "status": "ok",
      "data": { /* Orthanc server object */ }
    }
    ```
    - `data`: The Orthanc server object with the specified UUID.
  - **Error:** `{ status: "error", message: "...", error: "..." }`

### Get All Orthanc Servers
- **GET** `/nodes/orthanc-servers`
  - **Response:**
    ```json
    {
      "status": "ok",
      "data": [ /* Array of Orthanc server objects */ ]
    }
    ```
    - `data`: The list of all Orthanc servers.
  - **Error:** `{ status: "error", message: "...", error: "..." }`


### Add Orthanc Server
- **POST** `/nodes/orthanc-servers`
  - **Body:** 
    - orthancName: Name of the Orthanc server for Orthanc (string).
    - aet: Application Entity Title of the server (string).
    - hostNameSwarm: The name of the swarm node where the server will run (string).
    - publishedPortDicom: The published port for DICOM (int).
    - targetPortDicom: The port expose by the Orthanc server for DICOM and map with docker (int).
    - publishedPortWeb: The published port for Web interraction with the server (int).
    - targetPortWeb: The port expose by the Orthanc server for HTTP request and map with docker (int).
    ```json
      {
        "orthancName": "string",
        "aet": "string",
        "hostNameSwarm": "string",
        "publishedPortDicom": "int",
        "targetPortDicom": "int",
        "publishedPortWeb": "int",
        "targetPortWeb": "int"
      }
    ```
  - **Response:** `{ status: "ok", uuid: string }`
    - uuid: The Universally Unique Identifier of the node (string).
  - **Error:** `{ status: "error", message: "...", error: "..." }`

### Edit Orthanc Server
- **PUT** `/nodes/orthanc-servers/:uuid`
  - **Body:** 
    - orthancName: The new name of the Orthanc server for Orthanc (string).
    - aet: The new application Entity Title of the server (string).
    - hostNameSwarm: The name of the swarm node where the server migrate, all instances are transfered and link are rebuild (string).
    - publishedPortDicom: The new published port for DICOM (int).
    - targetPortDicom: The new port expose by the Orthanc server for DICOM and map with docker (int).
    - publishedPortWeb: The new published port for Web interraction with the server (int).
    - targetPortWeb: The new port expose by the Orthanc server for HTTP request and map with docker (int).
    ```json
      {
        "orthancName": "string",
        "aet": "string",
        "hostNameSwarm": "string",
        "publishedPortDicom": "int",
        "targetPortDicom": "int",
        "publishedPortWeb": "int",
        "targetPortWeb": "int"
      }
    ```
  - **Response:** `{ status: "ok", uuid: string }`
    - uuid: The Universally Unique Identifier of the node. It change if the host of the swarm change (string).


### Add Remote Server
- **POST** `/nodes/orthanc-servers/remote`
  - **Body:** 
    - username: The username of a orthanc user of this server.
    - password: The password correspondinf to the username.
    - ip: The IP address of the server.
    - publishedPortDicom: The published port for DICOM (int).
    - publishedPortWeb: The published port for Web interraction with the server (int).
    
    ```json
      {
        "username": "string",
        "password": "string",
        "ip": "string",
        "publishedPortWeb": "int",
        "publishedPortDicom": "int"
    }
    ```
  - **Response:** `{ status: "ok", uuid: string }`
    - uuid: The Universally Unique Identifier of the node (string).

### Change Value To The Database
- **PUT** `/nodes/orthanc-servers/remote/:uuid`
  - **Body:**
    
    - ip: The new IP address of the server.
    - publishedPortDicom: The new published port for DICOM (int).
    - publishedPortWeb: The new published port for Web interraction with the server (int).
    
    ```json
      {
        "ip": "string",
        "publishedPortWeb": "int",
        "publishedPortDicom": "int"
    }
    ```
  - **Response:** `{ status: "ok", uuid: string }`
    - uuid: The Universally Unique Identifier of the node. It change if the host of the swarm change (string).

## Orthanc Users

### Add User to Orthanc Server
Add a user to the OrthancServer if it is in the swarm, if not it just add the user in the database.
- **POST** `/nodes/orthanc-servers/:uuid/users`
  - **Body:** User data
    - username: The username for the new user (string).
    - password: The password for the new user (string).
    ```json
    {
      "username": "string",
      "password": "string"
    }
    ```
  - **Response:**
    ```json
    {
      "status": "ok",
      "userId": "string"
    }
    ```
    - `userId`: The unique identifier of the created user.
  - **Error:**
    ```json
    {
      "status": "error",
      "message": "Failed to add user",
      "error": "..."
    }
    ```

### Delete User from Orthanc Server
- **DELETE** `/nodes/orthanc-servers/:uuid/users/:userId`
  - **Response:**
    ```json
    {
      "status": "ok"
    }
    ```
  - **Error:**
    ```json
    {
      "status": "error",
      "message": "Failed to delete user: ...",
      "error": "..."
    }
    ```

## Modalities

### Get Modality by UUID
- **GET** `/nodes/modalities/:uuid`
  - **Response:**
    ```json
    {
      "status": "ok",
      "data": { /* Modality object */ }
    }
    ```
    - `data`: The modality object with the specified UUID.

### Add Modality
- **POST** `/nodes/modalities`
  - **Body:**
    - aet: Application Entity Title of the modality (string).
    - ip: The IP address of the Modality (string).
    - publishedPortDicom: The published port for DICOM (int).
    - description: A text to describe the modality (string)
    ```json
    {
        "aet": "string",
        "ip": "string",
        "publishedPortDicom": "int",
        "description": "string"
    }
    ```
  - **Response:** `{ status: "ok", uuid: string }`
    - uuid: The Universally Unique Identifier of the node. It change if the host of the swarm change (string).

### Edit Modality
- **PUT** `/nodes/modalities/:uuid`
  - **Body:**
    - aet: The new Application Entity Title of the modality (string).
    - ip: The new IP address of the Modality (string).
    - publishedPortDicom: The new published port for DICOM (int).
    - description: A new text to describe the modality (string)
    ```json
    {
        "aet": "string",
        "ip": "string",
        "publishedPortDicom": "int",
        "description": "string"
    }
    ```
  - **Response:** `{ status: "ok", uuid: string }`
    - uuid: The Universally Unique Identifier of the node. It change if the host of the swarm change (string).


## Tags

### Get Tags
- **GET** `/nodes/tags`
  - **Response:**
    ```json
    {
      "status": "ok",
      "data": [ /* Array of tag objects */ ]
    }
    ```
    - `data`: The list of all tags.
  - **Error:**
    ```json
    {
      "status": "error",
      "message": "Failed to retrieve tags: ...",
      "error": "..."
    }
    ```

### Add Tag to Node
- **POST** `/nodes/tags`
  - **Body:** Tag and node data
    - uuid: The uuid of tagged node (string).
    - tagName: The name of the assigned tag (string).
    - color :  The color at hexadecimal format (string).
    ```json
    {
      "uuid": "string",      // Node UUID
      "tagName": "string",   // Tag name
      "color": "string"      // Tag color (e.g., "#2f23d1")
    }
    ```
  - **Response:** `{ "status": "ok" }`
  - **Error:**
    ```json
    {
      "status": "error",
      "message": "Failed to add the tag",
      "error": "..."
    }
    ```

### Remove Tag from Node
- **POST** `/nodes/untag`
  - **Body:** Tag and node data
    - uuid: The uuid of node that is untag (string).
    - tagName: The tag name untag to the node (string).
    ```json
    {
      "uuid": "string",  // Node UUID
      "tagName": "string"        // Tag name to remove from node
    }
    ```
  - **Response:** `{ "status": "ok" }`
  - **Description:** Removes the specified tag from the node's tag list (does not delete the tag from the system).
  - **Error:**
    ```json
    {
      "status": "error",
      "message": "Failed to untagging the node: ...",
      "error": "..."
    }
    ```

### Edit Tag
- **PUT** `/nodes/tags/:tagName`
  - **Body:** Updated tag data
    - tagName: The name of the tag (string).
    - newName: The new name for the tag (string).
    - newColor: The new color of the tag hexadecimal (string).
    ```json
    {
      "newName": "string",      // New tag name
      "newColor": "string"      // New tag color (e.g., "#160e84")
    }
    ```
  - **Response:** `{ "status": "ok" }`
  - **Error:**
    ```json
    {
      "status": "error",
      "message": "Failed to edit the tag: ...",
      "error": "..."
    }
    ```
### Delete Tag
- **DELETE** `/nodes/tags/:tagName`
  - **Response:**
    ```json
    {
      "status": "ok",
      "tagName": "string"
    }
    ```
    - `tagName`: The name of the deleted tag.
  - **Error:**
    ```json
    {
      "status": "error",
      "message": "Failed to delete the tag: ...",
      "error": "..."
    }
    ```

---

# Edges (DICOM Links)

### Get Edge by ID
- **GET** `/edges/:id`
  - **Response:**
    ```json
    {
      "status": "ok",
      "data": { /* Edge object */ }
    }
    ```
    - `data`: The edge object with the specified ID.
  - **Error:**
    ```json
    {
      "status": "error",
      "message": "Failed to retrieve edge: ...",
      "error": "..."
    }
    ```

### Get All Edges
- **GET** `/edges`
  - **Response:**
    ```json
    {
      "status": "ok",
      "data": [ /* Array of edge objects */ ]
    }
    ```
    - `data`: The list of all edges.
  - **Error:**
    ```json
    {
      "status": "error",
      "message": "Failed to retrieve edges: ...",
      "error": "..."
    }
    ```

### Add Edge
Add or edit an edge between two modalities. If one of them is an Orthanc Server, it add/edit the other modality with the correct settings to the Orthanc server.
- **POST** `/edges`
  - **Body:**
    - from: The aet of the node (modality) from (string).
    - to: The aet of the node (modality) to (string).
    - allowEcho: Whether the to modality accept C-ECHO SCU commands issued by the from modality,
    - allowFind: Whether the to modality accept C-FIND SCU commands issued by the from modality,
    - allowGet: Whether the to modality accept C-GET SCU commands issued by the from modality,
    - allowMove: Whether the to modality accept C-MOVE SCU commands issued by the from modality,
    - allowStore: Whether the to modality accept C-STORE SCU commands issued by the from modality
    ```json
    {
      "from": "string",
      "to": "string",
      "allowEcho": true,
      "allowFind": false,
      "allowGet": true,
      "allowMove": true,
      "allowStore": true
    }
    ```
  - **Response:**
    ```json
    {
      "status": "ok",
      "id": "string"
    }
    ```
    - `id`: The unique identifier of the created edge.
  - **Error:**
    ```json
    {
      "status": "error",
      "message": "Failed to add edge: ...",
      "error": "..."
    }
    ```

### Delete Edge
- **DELETE** `/edges/:id`
  - **Response:**
    ```json
    {
      "status": "ok",
      "id": "string"
    }
    ```
    - `id`: The unique identifier of the deleted edge.
  - **Error:**
    ```json
    {
      "status": "error",
      "message": "Failed to delete the edge: ...",
      "error": "..."
    }
    ```

---

# Root

### API Info
- **GET** `/`
  - **Response:** `{ status: "ok", message: "Welcome to the OrthancCockpit API", version: "1.0.0" }`

---

## Error Response Format

All endpoints return errors in the following format:
```json
{
  "status": "error",
  "message": "A clear, human-readable error message",
  "error": "Optional technical error details"
}

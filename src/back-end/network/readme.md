<h1>This is the REST API of network service</h1>
# OrthancCockpit REST API

## Authentication

### Login
- **POST** `/login`
  - **Body:** `{ "username": string, "password": string }`
  - **Response:** `{ status: "ok", message: "Login successful", token: string }`
  - **Error:** `{ error: "Unauthorized" }`

---

## Servers

### Add Orthanc Server
- **POST** `/servers`
  - **Body:** Orthanc server data
  - **Response:** `{ status: "ok" }`
  - **Error:** `{ status: "error", message: "...", error: "..." }`

### Edit Orthanc Server
- **PUT** `/servers/:id`
  - **Body:** Updated server data
  - **Response:** `{ status: "ok" }`

### Delete Orthanc Server
- **DELETE** `/servers/:id`
  - **Body:** `{ id: string }`
  - **Response:** `{ status: "ok" }`

### Add Remote Server
- **POST** `/servers/remote`
  - **Body:** Remote server data
  - **Response:** `{ status: "ok" }`

---

## Modalities

### Add Modality
- **POST** `/modalities`
  - **Body:** Modality data
  - **Response:** `{ status: "ok" }`

### Edit Modality
- **PUT** `/modalities/:id`
  - **Body:** Updated modality data
  - **Response:** `{ status: "ok" }`

### Delete Modality
- **DELETE** `/modalities/:id`
  - **Body:** `{ id: string }`
  - **Response:** `{ status: "ok" }`

---

## Edges (DICOM Links)

### Add Edge
- **POST** `/edges`
  - **Body:** Edge data
  - **Response:** `{ status: "ok" }`

### Delete Edge
- **DELETE** `/edges/:id`
  - **Body:** `{ id: string }`
  - **Response:** `{ status: "ok" }`

---

## Network

### Get Network
- **GET** `/network`
  - **Response:** `{ status: "ok", data: ... }`

### Update Node Position
- **POST** `/network/node-position`
  - **Body:** Node position data
  - **Response:** `{ status: "ok" }`

### Update Status
- **GET** `/network/status`
  - **Response:** `{ status: "ok" }`

---

## Tags

### Get Tags
- **GET** `/tags`
  - **Response:** `{ status: "ok", data: [...] }`

### Add Tag
- **POST** `/tags`
  - **Body:** Tag data
  - **Response:** `{ status: "ok" }`

### Edit Tag
- **PUT** `/tags/:id`
  - **Body:** Updated tag data
  - **Response:** `{ status: "ok" }`

### Delete Tag
- **DELETE** `/tags/:id`
  - **Body:** `{ id: string }`
  - **Response:** `{ status: "ok" }`

### Tag Node
- **POST** `/tags/node`
  - **Body:** Tag and node data
  - **Response:** `{ status: "ok" }`

### Untag Node
- **POST** `/tags/node/untag`
  - **Body:** Tag and node data
  - **Response:** `{ status: "ok" }`

---

## Users

### Add User
- **POST** `/users`
  - **Body:** User data
  - **Response:** `{ status: "ok" }`

### Delete User
- **DELETE** `/users/:id`
  - **Body:** `{ id: string }`
  - **Response:** `{ status: "ok" }`

---

## Root

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

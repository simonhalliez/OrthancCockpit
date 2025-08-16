# OrthancCockpit

## Overview

**OrthancCockpit** is an open-source web application designed to provide a centralized dashboard for hospital IT departments to monitor and manage their DICOM network infrastructure.

In modern healthcare environments, hospitals often operate numerous interconnected DICOM entities, making it challenging to maintain a clear overview of their organization. OrthancCockpit addresses this challenge by offering an intuitive interface.
OrthancCockpit enhances the operational efficiency of medical imaging infrastructures and reduces the complexity of DICOM network administration.

---

## Features

- **DICOM Network Visualization** – Real-time overview of interconnected DICOM entities in an interractive map.
- **Orthanc Server Management** – Create, modify, add/remove users, and easily connect Orthanc servers.
- **Modality List Administration** – Simplify the organization and maintenance of modality configurations.
- **Configuration Without CLI** – Eliminate the need for complex command-line operations.

---

## Architecture

The OrthancCockpit system is composed of two main components:

1. **Frontend** – A web interface that allows users to visualize the DICOM network, configure Orthanc servers, and manage modalities.
2. **Backend** – Handles requests from the frontend, manages the configuration, and orchestrates Orthanc instances using a **Docker Swarm** environment.

```
   [ User Browser ]
          │
   ┌──────▼───────┐
   │   Frontend   │  (Svelte)
   └──────▲───────┘
          │ REST API
   ┌──────▼───────┐     ┌──────────────┐
   │   Backend    │◄───►│Database Neo4j│
   └──────▲───────┘     └──────────────┘
          │
   [ Docker Swarm ]
          │
   [ Orthanc Servers ]
```

---

## Installation

### Prerequisites
- **Docker**
- **Bash** available on your system
- Web browser with JavaScript enabled

### Steps
1. Clone the repository and navigate into the project folder:
   ```bash
   git clone https://github.com/YourUsername/OrthancCockpit.git
   cd OrthancCockpit
   ```
2. Move to the source folder:
   ```bash
   cd src
   ```
3. Build and pull images:
   ```bash
   bash projectManager.sh build
   ```
4. Initialize the project by running the setup script with your connection parameters:
   ```bash
   bash projectManager.sh init <IP_ADDRESS> <BACKEND_PORT> <FRONTEND_PORT> <ADMIN_PASSWORD>
   ```
   **Example:**
   ```bash
   bash projectManager.sh init 192.168.129.96 3002 3000 passwordAdmin
   ```
   - ```192.168.129.96``` → IP address of the machine
   - ```3002``` → port on which the backend listens
   - ```3000``` → port where the frontend is available
   - ```passwordAdmin``` → admin password
   The command to add a worker to the swarm is available with the following command:
   ```bash
   docker swarm join-token worker
   ```
5. Check that services are up:
   ```bash
   docker service ls
   ```
6. Open the Web browser:
   ```http://<IP_ADDRESS>:<FRONTEND_PORT>```
Stop the project with the following command. Note that all the created Orthanc servers are removed:
   ```bash
   bash projectManager.sh stop
   ```
### Note: 
     The administrator password is used for the Neo4j database. Go to ```http://<IP_ADDRESS>:7474``` 
     and log in with the username neo4j and the password admin.
---

## License
This project is licensed under the [MIT License](LICENSE).









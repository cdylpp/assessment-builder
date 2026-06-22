# Assessment Builder

Configurable assessment builder with versioned events, evolutions, and metrics. Once an assessment is built, you can export a grading sheet via Export to excel. This creates a stand-alone recording sheet.


## Architecture

The architecture is quite simple.
![Architecture Diagram](/assets/arcdiagram.png)

The user diagram shows the relationships between the components
![User Diagram](/assets/userdiagram.png)


## Quickstart

Docker desktop is required to run the application.

To run the server:

```bash
make dev
```

To close down the server
```bash
make down
```


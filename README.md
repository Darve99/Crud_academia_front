# CRUD Academia - Frontend

Aplicacion web en React + TypeScript para consumir la API de CRUD Academia.

## Quickstart (1 minuto)

1. Asegura backend activo en http://localhost:8080
2. Instala dependencias: npm install
3. Ejecuta frontend: npm run dev
4. Abre la app: http://localhost:5173
5. Si no hay datos, usa la seccion de importacion .dump desde la UI

Permite:

- CRUD de alumnos
- CRUD de materias
- Registro y consulta de notas
- Ranking academico
- Importacion de datos .dump (desde dump interno del backend o archivo local)

## Stack

- React 18
- TypeScript
- Vite
- Fetch API
- Docker + Nginx

## Requisitos

- Node.js 18+
- npm 9+
- Backend corriendo en http://localhost:8080 (o ajustar variable VITE_API_URL)

## Variables de entorno

Copia .env.example a .env.

- VITE_API_URL: URL base del backend
- VITE_APP_TITLE: titulo visual de la app

Ejemplo:

```env
VITE_API_URL=http://localhost:8080
VITE_APP_TITLE=CRUD Academia
```

## Ejecucion local

```bash
npm install
npm run dev
```

App disponible en: http://localhost:5173

## Build de produccion

```bash
npm run build
```

## Docker

```bash
docker build -t crud-academia-front .
docker run -d --name crud-academia-front -p 3000:80 crud-academia-front
```

App disponible en: http://localhost:3000

## Flujo de importacion .dump desde UI

1. Abrir la seccion Importar archivo .dump.
2. Elegir una de estas opciones:
- Importar dump de prueba listado por el backend.
- Subir un archivo local con extension .dump.
3. Confirmar la accion.
4. La app recarga datos automaticamente despues de importar.

## Endpoints backend usados por frontend

- GET /api/alumnos
- POST /api/alumnos
- PUT /api/alumnos/{id}
- DELETE /api/alumnos/{id}
- GET /api/materias
- POST /api/materias
- PUT /api/materias/{id}
- DELETE /api/materias/{id}
- POST /api/notas
- GET /api/notas/alumno/{alumnoId}?materiaId={materiaId}
- GET /api/import/dumps
- POST /api/import/dumps/{fileName}
- POST /api/import/dumps/upload

## Troubleshooting rapido

- Si falla la conexion al backend, revisar VITE_API_URL y CORS en backend (FRONTEND_ORIGIN).
- Si la importacion .dump responde error, validar extension, formato SQL y que la API este activa.

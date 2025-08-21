# File Parser CRUD API with Progress Tracking

Express.js + MongoDB + Redis + BullMQ implementation.

## Features
- Upload CSV/XLSX/PDF via streaming (Busboy) — supports large files.
- Real-time progress:
  - REST: `GET /files/:id/progress`
  - SSE: `GET /files/:id/stream`
- Asynchronous parsing (BullMQ worker):
  - CSV → JSON rows
  - Excel → Sheets → JSON
  - PDF → pages text
- CRUD:
  - List `GET /files`
  - Get parsed `GET /files/:id`
  - Delete `DELETE /files/:id`
- Auth: demo JWT for write endpoints (`POST /files`, `DELETE /files/:id`).
- Production-ready structure & .env.

## Quick Start

```bash
git clone <your-repo-url>
cd file-parser-crud-api
cp .env.example .env
# edit .env with Mongo, Redis, secrets
npm install
npm run start          # start API
npm run worker         # start background worker (in another terminal)
```

Default: `http://localhost:5000`

## .env

```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/file_parser_crud
REDIS_URL=redis://localhost:6379
JWT_SECRET=change_me_super_secret
UPLOAD_DIR=./uploads
```

## API

### Auth
`POST /auth/login` → `{ token }`

### Upload (JWT required)
`POST /files` (multipart/form-data, field name: `file`)

Returns `202 Accepted`:
```json
{ "file_id": "uuid", "status": "processing", "message": "Upload received. Parsing has started." }
```

### Progress
`GET /files/{file_id}/progress` →
```json
{ "file_id": "uuid", "status": "uploading|processing|ready|failed", "progress": 42 }
```

### SSE (bonus)
`GET /files/{file_id}/stream` (Server-Sent Events)

### Get Parsed
`GET /files/{file_id}` → parsed JSON, or:
```json
{ "message": "File upload or processing in progress. Please try again later." }
```

### List
`GET /files`

### Delete (JWT required)
`DELETE /files/{file_id}`

## Notes on Progress
- During upload, percentage is estimated using `Content-Length` for the entire request and capped at 90%.
- Status switches to `processing` (95%) when the file is saved and the parse job is enqueued.
- When parsing finishes, status becomes `ready` (100%).

## Postman Collection
Import `postman_collection.json` and set `{{baseUrl}}` (default `http://localhost:5000`).

## Tests (optional)
You can add Jest tests under `tests/` to cover upload and parsing logic.

## License
MIT

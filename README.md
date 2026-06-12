# IRIS Node API

Backend serverless de Vercel usado como proxy seguro entre los clientes IRIS y Ollama.

## Flujo

```text
Iris Web / IRISAPPMOVIL
  -> https://iris-node.vercel.app/api/chat
  -> Vercel iris-node
  -> https://ollama.irisapp.es/api/chat
  -> Cloudflare Tunnel
  -> Spark 172.31.17.20:11435
  -> llama3.1:latest
```

## Variables de entorno Vercel

```env
OLLAMA_BASE_URL=https://ollama.irisapp.es
OLLAMA_MODEL=llama3.1:latest
IRIS_REQUIRE_API_KEY=false
```

`IRIS_API_KEY` solo debe usarse si `IRIS_REQUIRE_API_KEY=true` y todos los clientes envian `Authorization`.
Para la web publica, mantener `IRIS_REQUIRE_API_KEY=false`.

## Verificacion

```bash
npm test

curl https://ollama.irisapp.es/api/tags

curl -X POST https://ollama.irisapp.es/api/chat \
  -H "Content-Type: application/json" \
  -d '{"model":"llama3.1:latest","messages":[{"role":"user","content":"Responde OK"}],"stream":false}'
```

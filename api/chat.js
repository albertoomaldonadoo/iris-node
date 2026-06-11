export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.IRIS_API_KEY;
  if (apiKey) {
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${apiKey}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  const ollamaBaseUrl = process.env.OLLAMA_BASE_URL;
  if (!ollamaBaseUrl) {
    return res.status(500).json({ error: "OLLAMA_BASE_URL is not configured" });
  }

  try {
    const body = req.body ?? {};
    const model = body.model ?? process.env.OLLAMA_MODEL ?? "llama3.1:latest";

    let messages;
    if (Array.isArray(body.messages) && body.messages.length > 0) {
      messages = body.messages.map((m) => ({
        role: m.role ?? "user",
        content: m.text ?? m.content ?? "",
      }));
    } else if (body.message) {
      messages = [{ role: "user", content: body.message }];
    } else {
      return res.status(400).json({ error: "messages or message is required" });
    }

    const ollamaRes = await fetch(`${ollamaBaseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
      }),
    });

    if (!ollamaRes.ok) {
      const detail = await ollamaRes.text();
      throw new Error(`Ollama error ${ollamaRes.status}: ${detail}`);
    }

    const data = await ollamaRes.json();
    return res.status(200).json({
      response: data.message?.content ?? "",
      model: data.model,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

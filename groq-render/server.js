const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Curated models supported by Groq
const CURATED_MODELS = [
  {
    id: 'qwen/qwen3.8-27b',
    name: 'Qwen 3.8 27B',
    badge: 'Ультраскорость & Ум',
    context: '32k',
    speed: '~700+ т/сек',
    recommended: true,
    description: 'Молниеносный отклик на чистом русском языке: отлично для семьи, учебы, кулинарии и советов'
  },
  {
    id: 'openai/gpt-oss-120b',
    name: 'GPT-OSS 120B',
    badge: 'Флагман 120B',
    context: '64k',
    speed: '~350 т/сек',
    recommended: true,
    description: 'Массивная модель на 120 млрд параметров: глубокие знания, подробные ответы и рассуждения'
  },
  {
    id: 'openai/gpt-oss-20b',
    name: 'GPT-OSS 20B',
    badge: 'Компактный GPT',
    context: '32k',
    speed: '~600 т/сек',
    recommended: false,
    description: 'Быстрые и четкие ответы на любые повседневные вопросы'
  },
  {
    id: 'allam-2-7b',
    name: 'Allam 2 7B',
    badge: 'Мультиязычный 7B',
    context: '8k',
    speed: '~800 т/сек',
    recommended: false,
    description: 'Легкая и быстрая модель'
  }
];

function getApiKey(req) {
  const headerKey = req.headers['x-groq-api-key'];
  if (headerKey && typeof headerKey === 'string' && headerKey.trim()) {
    return headerKey.trim();
  }
  if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim()) {
    return process.env.GROQ_API_KEY.trim();
  }
  return null;
}

// Endpoint: Check server status and if env key exists
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    hasEnvKey: !!(process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim()),
    time: Date.now()
  });
});

// Endpoint: Verify API Key
app.post('/api/verify', async (req, res) => {
  try {
    const apiKey = req.body.apiKey || getApiKey(req);
    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: 'API-ключ Groq не предоставлен'
      });
    }

    const response = await fetch('https://api.groq.com/openai/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      const errMsg = data?.error?.message || `Ошибка Groq API: ${response.status} ${response.statusText}`;
      return res.status(response.status).json({
        success: false,
        error: errMsg
      });
    }

    const chatModels = (data.data || [])
      .filter(m => !m.id.includes('whisper') && !m.id.includes('guard'))
      .map(m => m.id);

    return res.json({
      success: true,
      modelsCount: data.data?.length || 0,
      chatModels: chatModels
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: 'Не удалось связаться с серверами Groq: ' + err.message
    });
  }
});

// Endpoint: List available models
app.get('/api/models', async (req, res) => {
  const apiKey = getApiKey(req);
  if (!apiKey) {
    // Return curated list with fallback status
    return res.json({
      success: true,
      live: false,
      models: CURATED_MODELS
    });
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    if (!response.ok) {
      return res.json({
        success: true,
        live: false,
        models: CURATED_MODELS
      });
    }

    const data = await response.json();
    const liveIds = new Set((data.data || []).map(m => m.id));

    // Merge curated with live models
    const enriched = CURATED_MODELS.map(m => ({
      ...m,
      available: liveIds.has(m.id)
    }));

    // Add any additional live models that aren't in curated
    const curatedIds = new Set(CURATED_MODELS.map(m => m.id));
    (data.data || []).forEach(m => {
      if (!curatedIds.has(m.id) && !m.id.includes('whisper')) {
        enriched.push({
          id: m.id,
          name: m.id,
          badge: m.id.includes('llama') ? 'Meta Llama' : 'Groq Model',
          context: m.context_window ? `${Math.round(m.context_window / 1024)}k` : 'Auto',
          speed: 'Высокая',
          recommended: false,
          description: `Модель из аккаунта Groq (${m.owned_by || 'Groq'})`,
          available: true
        });
      }
    });

    return res.json({
      success: true,
      live: true,
      models: enriched
    });
  } catch (err) {
    return res.json({
      success: true,
      live: false,
      models: CURATED_MODELS
    });
  }
});

// Endpoint: Chat completion (streaming and non-streaming)
app.post('/api/chat', async (req, res) => {
  const apiKey = getApiKey(req);
  if (!apiKey) {
    return res.status(401).json({
      error: {
        message: 'Groq API ключ не указан. Пожалуйста, укажите ваш ключ в настройках.'
      }
    });
  }

  const {
    model = 'qwen/qwen3.8-27b',
    messages = [],
    temperature = 0.7,
    max_tokens = 4096,
    stream = true
  } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({
      error: { message: 'Массив сообщений (messages) не может быть пустым' }
    });
  }

  const abortController = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) {
      abortController.abort();
    }
  });

  try {
    const groqPayload = {
      model,
      messages,
      temperature: Number(temperature) || 0.7,
      max_tokens: Number(max_tokens) || 4096,
      stream: !!stream
    };

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(groqPayload),
      signal: abortController.signal
    });

    if (!groqRes.ok) {
      let errBody;
      try {
        errBody = await groqRes.json();
      } catch (e) {
        errBody = { error: { message: `Groq error status: ${groqRes.status}` } };
      }
      return res.status(groqRes.status).json(errBody);
    }

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      // Node Web Streams body
      const reader = groqRes.body.getReader();
      const decoder = new TextDecoder('utf-8');

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        const chunk = decoder.decode(value, { stream: true });
        res.write(chunk);
        if (typeof res.flush === 'function') {
          res.flush();
        }
      }

      res.end();
    } else {
      const data = await groqRes.json();
      return res.json(data);
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.end();
    }
    console.error('Chat error:', err);
    if (!res.headersSent) {
      return res.status(500).json({
        error: { message: 'Внутренняя ошибка сервера: ' + err.message }
      });
    } else {
      res.write(`event: error\ndata: ${JSON.stringify({ error: { message: err.message } })}\n\n`);
      res.end();
    }
  }
});

// Fallback to index.html for SPA
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Groq AI Chat server running on http://0.0.0.0:${PORT}`);
});

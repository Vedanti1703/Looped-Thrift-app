const axios = require('axios');
const { Message } = require('../models/Message');
const { tools, executeTool, SYSTEM_PROMPT } = require('../services/agentTools');

// Seeding the assistant user (ran once or verified on server startup)
exports.getOrCreateAssistantUser = async () => {
  const User = require('../models/User');
  try {
    let assistant = await User.findOne({ email: 'assistant@looped.app' });
    if (!assistant) {
      assistant = await User.create({
        email: 'assistant@looped.app',
        password: '$2a$10$NotRealPasswordUsedForLoopedAIAssistantToken12345',
        name: 'Looped AI',
        avatar: '🤖',
        isVerified: true
      });
      console.log('🤖 Looped AI assistant user created successfully.');
    }
    return assistant;
  } catch (err) {
    console.error('Error seeding assistant user:', err.message);
    return null;
  }
};

// Generates response using OpenAI LLM Tool-Calling Agent (gpt-4o-mini)
// Returns { text: string, suggestedProducts: Product[] }
exports.generateResponse = async (text, conversation, userId) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return {
        text: "Sorry, I'm having trouble right now — let me connect you with our support team.",
        suggestedProducts: []
      };
    }

    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    // 1. Fetch recent conversation history (~20 messages)
    const dbMessages = await Message.find({ conversationId: conversation._id })
      .sort({ createdAt: 1 })
      .limit(20);

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT }
    ];

    // Format DB messages for OpenAI
    dbMessages.forEach(msg => {
      messages.push({
        role: msg.senderName === 'Looped AI' ? 'assistant' : 'user',
        content: msg.text
      });
    });

    // Ensure the current incoming prompt is included if not already at end
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== 'user' || lastMsg.content !== text.trim()) {
      messages.push({ role: 'user', content: text.trim() });
    }

    // Array to collect product recommendations returned during tool calls
    const suggestedProducts = [];
    const collectProducts = (result) => {
      if (!result || !result.success) return;
      let items = [];
      if (Array.isArray(result.products)) items = result.products;
      else if (Array.isArray(result.rentableProducts)) items = result.rentableProducts;
      else if (result.product) items = [result.product];

      items.forEach(p => {
        if (p && p._id && !suggestedProducts.some(sp => (sp._id || sp).toString() === (p._id || p).toString())) {
          suggestedProducts.push(p);
        }
      });
    };

    // 2. Initial OpenAI Chat Completion call
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model,
        messages,
        tools,
        tool_choice: 'auto',
        max_tokens: 300
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        timeout: 10000
      }
    );

    let responseMessage = response.data?.choices?.[0]?.message;

    // 3. Tool execution loop (max 5 iterations)
    let loopCount = 0;
    while (responseMessage?.tool_calls && responseMessage.tool_calls.length > 0 && loopCount < 5) {
      loopCount++;
      messages.push(responseMessage);

      for (const toolCall of responseMessage.tool_calls) {
        const name = toolCall.function.name;
        let args = {};
        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch (e) {
          args = {};
        }

        const result = await executeTool(name, args, 'web', conversation._id.toString());
        collectProducts(result);

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: name,
          content: JSON.stringify(result)
        });
      }

      const nextRes = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model,
          messages,
          tools,
          tool_choice: 'auto',
          max_tokens: 300
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
          },
          timeout: 10000
        }
      );

      responseMessage = nextRes.data?.choices?.[0]?.message;
    }

    const finalText = responseMessage?.content || "I'm sorry, I encountered an issue. Let me connect you to support.";
    return {
      text: finalText,
      suggestedProducts: suggestedProducts.slice(0, 6)
    };

  } catch (err) {
    console.error('OpenAI Error in generateResponse:', err.message);
    return {
      text: "Sorry, I'm having trouble right now — let me connect you with our support team.",
      suggestedProducts: []
    };
  }
};

// Generates response for uploaded photo using Visual Search pipeline
exports.generateImageSearchResponse = async (imageUrl, conversation, userId) => {
  try {
    const { searchByImage } = require('../services/visualSearch');
    const result = await searchByImage(imageUrl);

    if (result.success && Array.isArray(result.products) && result.products.length > 0) {
      return {
        text: `I found some items similar to that photo! Here's what matched: "${result.description}"`,
        suggestedProducts: result.products.slice(0, 6)
      };
    }

    return {
      text: "I couldn't find anything closely matching that photo — try browsing our categories or asking me for recommendations!",
      suggestedProducts: []
    };
  } catch (err) {
    console.error('Error in generateImageSearchResponse:', err.message);
    return {
      text: "I had trouble analyzing that photo right now. Please try again or ask me a text question!",
      suggestedProducts: []
    };
  }
};

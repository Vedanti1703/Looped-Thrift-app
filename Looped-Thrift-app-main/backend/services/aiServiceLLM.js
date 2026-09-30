const { WhatsAppConversation, WhatsAppMessage } = require('../models/WhatsAppConversation');
const whatsappService = require('./whatsappService');
const loopedAiController = require('../controllers/loopedAiController');
const { tools, executeTool, SYSTEM_PROMPT } = require('./agentTools');
const axios = require('axios');

// OpenAI completion helper
async function getLlmResponse(messages, toolsList) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const payload = {
    model,
    messages,
    max_tokens: 300
  };

  if (toolsList && toolsList.length > 0) {
    payload.tools = toolsList;
    payload.tool_choice = 'auto';
  }

  const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    payload,
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      timeout: 10000
    }
  );

  return response.data?.choices?.[0]?.message;
}

// Rewrites robotic system messages during checkout to make them natural and conversational
async function rewriteRoboticReply(roboticReply, userText) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    const prompt = `You are a friendly shopping assistant.
The customer is in a checkout flow. The state machine generated this robotic system message:
"${roboticReply}"

The customer's last input was: "${userText}"

Rewrite the system message to sound conversational, natural, and friendly.
CRITICAL:
1. Maintain all links (like http://localhost:5173/product/...), sizes, quantities, names, addresses, and prices exactly. Do not invent or change them.
2. Maintain any Order IDs (like LOOPED-ORD-123456) exactly.
3. Keep it brief. Ask for only one thing at a time.
4. If it is a final confirmation summary, present it clearly and ask if everything looks correct.`;

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model,
        messages: [
          { role: 'system', content: 'You rewrite system messages to sound conversational and friendly.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 300
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        timeout: 5000
      }
    );

    return response.data?.choices?.[0]?.message?.content || roboticReply;
  } catch (err) {
    console.error('Error rewriting robotic reply:', err.message);
    return roboticReply; // Fallback to raw reply on failure
  }
}

// Conversation Processing for WhatsApp
exports.processIncomingMessage = async (phone, text, senderName) => {
  let convo = await WhatsAppConversation.findOne({ phone });
  if (!convo) {
    convo = await WhatsAppConversation.create({
      phone,
      name: senderName,
      loopedAiState: { step: 'idle', orderData: {} }
    });
  }

  // 1. If state is not idle (checkout flow active), delegate to state machine + LLM rewriter
  if (convo.loopedAiState && convo.loopedAiState.step !== 'idle') {
    const roboticReply = await loopedAiController.generateResponse(text, convo, null);
    const friendlyReply = await rewriteRoboticReply(roboticReply, text);
    
    // Save generated AI response in history
    await WhatsAppMessage.create({
      phone,
      sender: 'ai',
      text: friendlyReply
    });

    await whatsappService.sendMessage(phone, friendlyReply);
    return;
  }

  // 2. Normal LLM Conversation flow
  const dbMessages = await WhatsAppMessage.find({ phone }).sort({ createdAt: 1 }).limit(20);

  const openaiMessages = [
    {
      role: 'system',
      content: SYSTEM_PROMPT
    }
  ];

  dbMessages.forEach(msg => {
    openaiMessages.push({
      role: msg.sender === 'user' ? 'user' : 'assistant',
      content: msg.text
    });
  });

  try {
    let responseMessage = await getLlmResponse(openaiMessages, tools);

    let loopCount = 0;
    while (responseMessage?.tool_calls && responseMessage.tool_calls.length > 0 && loopCount < 5) {
      loopCount++;
      openaiMessages.push(responseMessage);

      for (const toolCall of responseMessage.tool_calls) {
        const name = toolCall.function.name;
        let args = {};
        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch (e) {}

        const result = await executeTool(name, args, 'whatsapp', phone);

        openaiMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: name,
          content: JSON.stringify(result)
        });
      }

      responseMessage = await getLlmResponse(openaiMessages, tools);
    }

    const finalReply = responseMessage?.content || "I'm sorry, I encountered an issue. Let me connect you to support.";
    
    // Save response in history
    await WhatsAppMessage.create({
      phone,
      sender: 'ai',
      text: finalReply
    });

    await whatsappService.sendMessage(phone, finalReply);

  } catch (err) {
    console.error('LLM API error:', err.message);
    throw err; // propagates to aiService.js for rule-based fallback
  }
};

exports.executeTool = executeTool;
exports.rewriteRoboticReply = rewriteRoboticReply;

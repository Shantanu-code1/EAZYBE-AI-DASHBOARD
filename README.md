# AI Dashboard

A beautiful, modern AI dashboard with input/output areas and customizable prompts.

## Features

- 🎨 Modern, gradient UI with glassmorphism effects
- 💬 Real-time input and output display
- ⚙️ Customizable system prompts
- 📝 Conversation history tracking
- 📋 Copy messages to clipboard
- 🗑️ Clear chat functionality
- 📱 Responsive design

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The application will start on `http://localhost:5173`

### Build for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Usage

1. **Input Area**: Type your message in the left panel
2. **Output Area**: View the AI response in the right panel
3. **Settings**: Click the Settings button to customize the system prompt
4. **Conversation History**: View all messages in the bottom panel
5. **Clear Chat**: Remove all messages and start fresh

## Customization

### System Prompt

Click the **Settings** button to modify the system prompt. This controls the AI's behavior and personality. The default prompt is:

```
You are a helpful AI assistant.
```

You can customize it to make the AI respond in specific ways, such as:
- Professional technical assistant
- Creative writing partner
- Code reviewer
- Educational tutor

### Styling

The application uses Tailwind CSS. You can customize the theme in `tailwind.config.js`.

## Integration with AI APIs

To connect this dashboard to a real AI model:

1. Replace the simulated response in `Dashboard.tsx` (around line 28-39)
2. Add your API key to environment variables
3. Install the appropriate SDK (e.g., `openai`, `@anthropic-ai/sdk`)
4. Make API calls in the `handleSubmit` function

Example with OpenAI:

```typescript
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true // Only for development
})

const handleSubmit = async (e: React.FormEvent) => {
  // ... existing code ...
  
  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      { role: "system", content: systemPrompt },
      ...messages.map(m => ({ role: m.role, content: m.content })),
      { role: "user", content: input }
    ],
  })
  
  const aiMessage: Message = {
    role: 'assistant',
    content: completion.choices[0].message.content,
    timestamp: new Date()
  }
  
  setMessages(prev => [...prev, aiMessage])
}
```

## Technology Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Lucide React** - Icons

## License

MIT


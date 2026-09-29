import { defineAgent } from 'eve'

export default defineAgent({
  model: process.env.AI_GATEWAY_MODEL || 'openai/gpt-5.5',
  defaultTools: false,
})
